/**
 * Admin Command Center — read platform data from Supabase.
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { parseTypeCategory } = require('./event-types');
const { scanEventHealth } = require('./admin-event-health');

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function platformFee(subtotal) {
  return subtotal * 0.045 + 0.2;
}

function listingStatusLabel(status) {
  const s = String(status || '').trim();
  if (s === 'Approved') return 'Live';
  if (s === 'Pending Review') return 'Pending';
  if (s === 'Rejected') return 'Rejected';
  return s || 'Draft';
}

function isSpamReview(text) {
  const t = String(text || '').toLowerCase();
  return /buy cheap|viagra|casino|click here|http:\/\//i.test(t);
}

async function fetchDashboardMetrics(sb) {
  const [eventsRes, workshopsRes, orgRes, attendeesRes, accountsRes, regsRes] = await Promise.all([
    sb.from('events').select('id, event_type, approval_status, starts_at'),
    sb.from('workshops').select('id', { count: 'exact', head: true }),
    sb.from('organisers').select('id', { count: 'exact', head: true }),
    sb.from('attendees').select('id', { count: 'exact', head: true }),
    sb.from('hub_accounts').select('user_id', { count: 'exact', head: true }),
    sb.from('registrations').select('amount_paid, payment_status'),
  ]);

  if (eventsRes.error) throw new Error(eventsRes.error.message);
  if (regsRes.error) throw new Error(regsRes.error.message);

  const events = eventsRes.data || [];
  const approved = events.filter((e) => e.approval_status === 'Approved');

  let meetings = 0;
  let exhibitions = 0;
  approved.forEach((e) => {
    const cat = parseTypeCategory(e.event_type);
    if (cat === 'exhibition') exhibitions += 1;
    else meetings += 1;
  });

  const training = workshopsRes.count || 0;
  const totalRevenue = (regsRes.data || [])
    .filter((r) => r.payment_status === 'Paid')
    .reduce((sum, r) => sum + (Number(r.amount_paid) || 0), 0);

  const now = Date.now() - 86400000;
  const liveEvents = approved.filter((e) => {
    if (!e.starts_at) return true;
    const t = new Date(e.starts_at).getTime();
    return !Number.isNaN(t) && t >= now;
  }).length;

  return {
    revenue: round2(totalRevenue),
    fees: round2(platformFee(totalRevenue)),
    listings: {
      meetings,
      exhibitions,
      training,
      total: approved.length,
    },
    organisers: orgRes.count || 0,
    providers: training,
    attendees: Math.max(attendeesRes.count || 0, accountsRes.count || 0),
    liveEvents,
    currency: 'GBP',
  };
}

async function fetchAlerts(sb) {
  const alerts = [];
  const health = await scanEventHealth();
  if (health.count > 0) {
    alerts.push({
      id: 'event-health',
      severity: 'high',
      title: `${health.count} published event${health.count === 1 ? '' : 's'} missing data`,
      detail: 'Fix dates, organisers, VAT, or profile fields in Event data issues.',
      time: new Date().toISOString(),
    });
  }

  const pendingEvents = await sb
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('approval_status', 'Pending Review');
  if (!pendingEvents.error && (pendingEvents.count || 0) > 0) {
    alerts.push({
      id: 'pending-events',
      severity: 'medium',
      title: `${pendingEvents.count} event${pendingEvents.count === 1 ? '' : 's'} pending approval`,
      detail: 'Review listings in Content Moderation.',
      time: new Date().toISOString(),
    });
  }

  const pendingApps = await sb
    .from('registrations')
    .select('id', { count: 'exact', head: true })
    .eq('application_status', 'Pending');
  if (!pendingApps.error && (pendingApps.count || 0) > 0) {
    alerts.push({
      id: 'pending-apps',
      severity: 'medium',
      title: `${pendingApps.count} ticket application${pendingApps.count === 1 ? '' : 's'} awaiting review`,
      detail: 'Organisers may need to approve application-based tickets.',
      time: new Date().toISOString(),
    });
  }

  return alerts;
}

async function fetchActivity(sb) {
  const items = [];

  const [eventsRes, regsRes, reviewsRes, orgRes] = await Promise.all([
    sb
      .from('events')
      .select('title, approval_status, created_at')
      .order('created_at', { ascending: false })
      .limit(6),
    sb
      .from('registrations')
      .select('payment_status, amount_paid, created_at, events(title), attendees(name, email)')
      .order('created_at', { ascending: false })
      .limit(6),
    sb
      .from('reviews')
      .select('rating, created_at, events(title), attendees(name, email)')
      .order('created_at', { ascending: false })
      .limit(4),
    sb.from('organisers').select('name, created_at').order('created_at', { ascending: false }).limit(3),
  ]);

  (eventsRes.data || []).forEach((e) => {
    items.push({
      time: e.created_at,
      text: `Event "${String(e.title || '').trim()}" — ${listingStatusLabel(e.approval_status)}`,
      type: 'event',
    });
  });

  (regsRes.data || []).forEach((r) => {
    const who = r.attendees?.name || r.attendees?.email || 'Attendee';
    const eventTitle = r.events?.title || 'an event';
    const paid =
      r.payment_status === 'Paid'
        ? ` · £${round2(Number(r.amount_paid) || 0).toFixed(2)}`
        : r.payment_status === 'Free'
          ? ' · Free'
          : '';
    items.push({
      time: r.created_at,
      text: `${who} registered for ${eventTitle}${paid}`,
      type: 'registration',
    });
  });

  (reviewsRes.data || []).forEach((r) => {
    const who = r.attendees?.name || r.attendees?.email || 'Attendee';
    items.push({
      time: r.created_at,
      text: `${who} left a ${r.rating}★ review on ${r.events?.title || 'an event'}`,
      type: 'review',
    });
  });

  (orgRes.data || []).forEach((o) => {
    items.push({
      time: o.created_at,
      text: `Organiser profile created: ${String(o.name || '').trim()}`,
      type: 'organiser',
    });
  });

  return items
    .filter((i) => i.time)
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 12);
}

async function fetchUsers(sb) {
  const [accountsRes, attendeesRes, organisersRes, authRes] = await Promise.all([
    sb.from('hub_accounts').select('user_id, role, display_name, hub_view'),
    sb.from('attendees').select('supabase_user_id, name, email, location'),
    sb.from('organisers').select('supabase_user_id, name, email, city, featured, listing_status'),
    sb.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  if (accountsRes.error) throw new Error(accountsRes.error.message);
  if (authRes.error) throw new Error(authRes.error.message);

  const authById = new Map((authRes.data?.users || []).map((u) => [u.id, u]));
  const attendeeByUser = new Map(
    (attendeesRes.data || []).filter((a) => a.supabase_user_id).map((a) => [a.supabase_user_id, a])
  );
  const organiserByUser = new Map(
    (organisersRes.data || []).filter((o) => o.supabase_user_id).map((o) => [o.supabase_user_id, o])
  );

  const users = [];
  const seen = new Set();

  for (const acc of accountsRes.data || []) {
    const auth = authById.get(acc.user_id);
    const org = organiserByUser.get(acc.user_id);
    const att = attendeeByUser.get(acc.user_id);
    let role = 'Attendee';
    if (acc.role === 'admin') role = 'Admin';
    else if (org) role = 'Organiser';
    else if (acc.hub_view === 'organiser') role = 'Organiser';

    users.push({
      id: acc.user_id,
      name: acc.display_name || org?.name || att?.name || auth?.user_metadata?.full_name || '—',
      email: auth?.email || att?.email || org?.email || '—',
      role,
      city: org?.city || att?.location || '—',
      postcode: '—',
      status: 'Active',
      featured: Boolean(org?.featured),
    });
    seen.add(acc.user_id);
  }

  for (const att of attendeesRes.data || []) {
    if (!att.supabase_user_id || seen.has(att.supabase_user_id)) continue;
    const auth = authById.get(att.supabase_user_id);
    users.push({
      id: att.supabase_user_id,
      name: att.name || '—',
      email: att.email || auth?.email || '—',
      role: 'Attendee',
      city: att.location || '—',
      postcode: '—',
      status: 'Active',
      featured: false,
    });
  }

  users.sort((a, b) => String(a.email).localeCompare(String(b.email)));
  return users;
}

async function fetchModeration(sb) {
  const [eventsRes, reviewsRes, regCountsRes] = await Promise.all([
    sb
      .from('events')
      .select('id, title, event_type, city, approval_status, organiser_id, organisers(name)')
      .order('created_at', { ascending: false })
      .limit(80),
    sb
      .from('reviews')
      .select('id, rating, review_text, created_at, events(title), attendees(name, email)')
      .order('created_at', { ascending: false })
      .limit(30),
    sb.from('registrations').select('event_id'),
  ]);

  if (eventsRes.error) throw new Error(eventsRes.error.message);
  if (reviewsRes.error) throw new Error(reviewsRes.error.message);

  const soldByEvent = new Map();
  (regCountsRes.data || []).forEach((r) => {
    if (!r.event_id) return;
    soldByEvent.set(r.event_id, (soldByEvent.get(r.event_id) || 0) + 1);
  });

  const listings = (eventsRes.data || []).map((e) => {
    const sold = soldByEvent.get(e.id) || 0;
    return {
      id: e.id,
      title: String(e.title || '').trim(),
      type: String(e.event_type || 'Event').trim(),
      organiser: e.organisers?.name || '—',
      city: e.city || '—',
      status: listingStatusLabel(e.approval_status),
      sold,
      capacity: null,
    };
  });

  const reviews = (reviewsRes.data || []).map((r) => {
    const text = String(r.review_text || '').trim();
    return {
      id: r.id,
      user: r.attendees?.name || r.attendees?.email || 'Anonymous',
      event: r.events?.title || '—',
      rating: Number(r.rating) || 0,
      text,
      time: r.created_at,
      spam: isSpamReview(text),
    };
  });

  return { listings, reviews };
}

async function fetchFinancials(sb) {
  const [orgsRes, regsRes] = await Promise.all([
    sb.from('organisers').select('id, name, stripe_account_id, payout_email').order('name'),
    sb
      .from('registrations')
      .select('created_at, payment_status, amount_paid, organisers(name)')
      .order('created_at', { ascending: false })
      .limit(40),
  ]);

  if (orgsRes.error) throw new Error(orgsRes.error.message);
  if (regsRes.error) throw new Error(regsRes.error.message);

  const revenueByOrg = new Map();
  (regsRes.data || [])
    .filter((r) => r.payment_status === 'Paid')
    .forEach((r) => {
      const name = r.organisers?.name || 'Unknown organiser';
      revenueByOrg.set(name, (revenueByOrg.get(name) || 0) + (Number(r.amount_paid) || 0));
    });

  const stripeAccounts = (orgsRes.data || []).map((o) => {
    const earned = revenueByOrg.get(o.name) || 0;
    return {
      organiser: o.name || '—',
      balance: earned > 0 ? `£${round2(earned).toFixed(2)}` : '—',
      lastPayout: '—',
      status: o.stripe_account_id ? 'Connected' : 'Not connected',
    };
  });

  const automationLog = (regsRes.data || []).map((r) => {
    const orgName = r.organisers?.name || 'Platform';
    const amt = Number(r.amount_paid) || 0;
    let line = `${orgName}: registration — ${r.payment_status}`;
    if (r.payment_status === 'Paid') line += ` (£${round2(amt).toFixed(2)})`;
    let status = 'info';
    if (r.payment_status === 'Paid') status = 'ok';
    if (r.payment_status === 'Refunded') status = 'error';
    return { ts: r.created_at, line, status };
  });

  return {
    stripeAccounts,
    payoutQueue: [],
    automationLog,
  };
}

const SPONSOR_HUB_SLOT = 'sponsor_hub';
const { buildSponsorRow, normalizeSponsorBlock } = require('./cms-sponsor-fields');

async function fetchSponsorBlock(sb) {
  const res = await sb.from('cms_blocks').select('*').eq('slot', SPONSOR_HUB_SLOT).maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return normalizeSponsorBlock(res.data);
}

async function saveSponsorBlock(sb, payload) {
  const body = String(payload.body || '').trim();
  if (!body) throw new Error('missing_body');

  const row = buildSponsorRow(payload);
  const res = await sb.from('cms_blocks').upsert(row, { onConflict: 'slot' }).select().single();
  if (res.error) throw new Error(res.error.message);
  return normalizeSponsorBlock(res.data);
}

async function getAdminSponsor() {
  if (!isSupabaseConfigured()) {
    return { configured: false, provider: 'supabase', block: null };
  }
  const sb = getSupabaseAdmin();
  const block = await fetchSponsorBlock(sb);
  return { configured: true, provider: 'supabase', block, updatedAt: new Date().toISOString() };
}

async function getAdminDashboard() {
  if (!isSupabaseConfigured()) {
    return { configured: false, provider: 'supabase' };
  }
  const sb = getSupabaseAdmin();
  const [metrics, alerts, activity] = await Promise.all([
    fetchDashboardMetrics(sb),
    fetchAlerts(sb),
    fetchActivity(sb),
  ]);
  return {
    configured: true,
    provider: 'supabase',
    metrics,
    alerts,
    activity,
    updatedAt: new Date().toISOString(),
  };
}

async function getAdminUsers() {
  if (!isSupabaseConfigured()) return { configured: false, provider: 'supabase', users: [] };
  const sb = getSupabaseAdmin();
  const users = await fetchUsers(sb);
  return { configured: true, provider: 'supabase', users, updatedAt: new Date().toISOString() };
}

async function getAdminModeration() {
  if (!isSupabaseConfigured()) {
    return { configured: false, provider: 'supabase', listings: [], reviews: [] };
  }
  const sb = getSupabaseAdmin();
  const data = await fetchModeration(sb);
  return { configured: true, provider: 'supabase', ...data, updatedAt: new Date().toISOString() };
}

async function getAdminFinancials() {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      provider: 'supabase',
      stripeAccounts: [],
      payoutQueue: [],
      automationLog: [],
    };
  }
  const sb = getSupabaseAdmin();
  const data = await fetchFinancials(sb);
  return { configured: true, provider: 'supabase', ...data, updatedAt: new Date().toISOString() };
}

module.exports = {
  getAdminDashboard,
  getAdminUsers,
  getAdminModeration,
  getAdminFinancials,
  getAdminSponsor,
  saveSponsorBlock,
  fetchSponsorBlock,
};
