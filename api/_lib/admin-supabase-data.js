/**
 * Admin Command Center — read platform data from Supabase.
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { parseTypeCategory } = require('./event-types');
const {
  registrationTicketRevenue,
  registrationBookingFee,
} = require('./booking-fees');

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function listingStatusLabel(status) {
  const s = String(status || '').trim();
  if (s === 'Approved') return 'Live';
  if (s === 'Pending Review') return 'Draft';
  if (s === 'Rejected') return 'Rejected';
  return s || 'Draft';
}

function isSpamReview(text) {
  const t = String(text || '').toLowerCase();
  return /buy cheap|viagra|casino|click here|http:\/\//i.test(t);
}

const INCOMPLETE_ORGANISER_FILTER =
  'description.is.null,description.eq.,photo_url.is.null,photo_url.eq.,website.is.null,website.eq.';

/** Actionable admin queue totals — used for alerts, attention, and sidebar badge (excludes event-health scan). */
async function fetchAdminActionCounts(sb) {
  const [
    openListingReportsRes,
    openReviewReportsRes,
    pendingOpportunitiesRes,
    claimDisputesRes,
    recentReviewsRes,
    incompleteOrgsRes,
  ] = await Promise.all([
    sb.from('listing_reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    sb.from('review_reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    sb
      .from('business_opportunities')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'Pending Review'),
    sb
      .from('organiser_claim_disputes')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open'),
    sb.from('reviews').select('review_text').order('created_at', { ascending: false }).limit(50),
    sb.from('organisers').select('id', { count: 'exact', head: true }).or(INCOMPLETE_ORGANISER_FILTER),
  ]);

  const spamReviews = (recentReviewsRes.data || []).filter((r) => isSpamReview(r.review_text)).length;

  return {
    openListingReports: openListingReportsRes.error ? 0 : openListingReportsRes.count || 0,
    openReviewReports: openReviewReportsRes.error ? 0 : openReviewReportsRes.count || 0,
    pendingOpportunities: pendingOpportunitiesRes.error ? 0 : pendingOpportunitiesRes.count || 0,
    openClaimDisputes: claimDisputesRes.error ? 0 : claimDisputesRes.count || 0,
    spamReviews,
    incompleteOrganisers: incompleteOrgsRes.error ? 0 : incompleteOrgsRes.count || 0,
  };
}

function sumAdminNotificationCounts(counts) {
  if (!counts) return 0;
  return (
    (counts.openListingReports || 0) +
    (counts.openReviewReports || 0) +
    (counts.spamReviews || 0) +
    (counts.pendingOpportunities || 0) +
    (counts.openClaimDisputes || 0)
  );
}

function buildAlertsFromCounts(counts) {
  const alerts = [];
  if (!counts) return alerts;

  if (counts.pendingOpportunities > 0) {
    alerts.push({
      id: 'pending-opportunities',
      severity: 'medium',
      title: `${counts.pendingOpportunities} business opportunit${counts.pendingOpportunities === 1 ? 'y' : 'ies'} pending review`,
      detail: 'Open Listing cleanup → Opportunities to approve or reject listings.',
      href: '#cleanup/opportunities?approval=pending',
      time: new Date().toISOString(),
    });
  }

  if (counts.incompleteOrganisers > 0) {
    alerts.push({
      id: 'incomplete-organisers',
      severity: 'low',
      title: `${counts.incompleteOrganisers} organiser profile${counts.incompleteOrganisers === 1 ? '' : 's'} missing data`,
      detail: 'Add description, photo, or website in Group profile cleanup.',
      href: '#cleanup/groups',
      time: new Date().toISOString(),
    });
  }

  if (counts.spamReviews > 0) {
    alerts.push({
      id: 'spam-reviews',
      severity: 'medium',
      title: `${counts.spamReviews} spam-like review${counts.spamReviews === 1 ? '' : 's'} detected`,
      detail: 'Highlighted on Content Moderation — remove in Supabase if needed.',
      href: '#moderation',
      time: new Date().toISOString(),
    });
  }

  if (counts.openListingReports > 0) {
    alerts.push({
      id: 'listing-reports',
      severity: 'medium',
      title: `${counts.openListingReports} listing report${counts.openListingReports === 1 ? '' : 's'} from users`,
      detail: 'Review reports on Content Moderation.',
      href: '#moderation',
      time: new Date().toISOString(),
    });
  }

  if (counts.openReviewReports > 0) {
    alerts.push({
      id: 'review-reports',
      severity: 'medium',
      title: `${counts.openReviewReports} review report${counts.openReviewReports === 1 ? '' : 's'} from users`,
      detail: 'Review reports on Content Moderation.',
      href: '#moderation',
      time: new Date().toISOString(),
    });
  }

  if (counts.openClaimDisputes > 0) {
    alerts.push({
      id: 'claim-disputes',
      severity: 'high',
      title: `${counts.openClaimDisputes} group profile dispute${counts.openClaimDisputes === 1 ? '' : 's'}`,
      detail: 'An organiser rejected a matched profile — resolve on the dashboard overview.',
      href: '#dashboard',
      time: new Date().toISOString(),
    });
  }

  return alerts;
}

/** Exclude E2E seed scripts only — avoid filtering legitimate titles or names. */
function isTestActivityText(text) {
  const t = String(text || '').toLowerCase();
  return (
    /e2e review test/.test(t) ||
    /review test attendee/.test(t) ||
    /e2e review host/.test(t)
  );
}

async function fetchDashboardMetrics(sb) {
  const cutoff = new Date(Date.now() - 86400000).toISOString();
  const [
    approvedEventsRes,
    workshopsRes,
    orgRes,
    attendeesRes,
    accountsRes,
    regsRes,
    liveDatedRes,
    liveUndatedRes,
  ] = await Promise.all([
    sb.from('events').select('event_type').eq('approval_status', 'Approved'),
    sb.from('workshops').select('id', { count: 'exact', head: true }),
    sb.from('organisers').select('id', { count: 'exact', head: true }),
    sb.from('attendees').select('id', { count: 'exact', head: true }),
    sb.from('hub_accounts').select('user_id', { count: 'exact', head: true }),
    sb.from('registrations').select('amount_paid, payment_status').eq('payment_status', 'Paid'),
    sb
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'Approved')
      .gte('starts_at', cutoff),
    sb
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'Approved')
      .is('starts_at', null),
  ]);

  if (approvedEventsRes.error) throw new Error(approvedEventsRes.error.message);
  if (regsRes.error) throw new Error(regsRes.error.message);

  const approved = approvedEventsRes.data || [];
  let meetings = 0;
  let exhibitions = 0;
  approved.forEach((e) => {
    const cat = parseTypeCategory(e.event_type);
    if (cat === 'exhibition') exhibitions += 1;
    else meetings += 1;
  });

  const training = workshopsRes.count || 0;
  let totalRevenue = 0;
  let hubBookingFees = 0;
  (regsRes.data || []).forEach((r) => {
    totalRevenue += registrationTicketRevenue(r);
    hubBookingFees += registrationBookingFee(r);
  });

  return {
    revenue: round2(totalRevenue),
    fees: round2(hubBookingFees),
    listings: {
      meetings,
      exhibitions,
      training,
      total: approved.length,
    },
    organisers: orgRes.count || 0,
    providers: training,
    attendees: Math.max(attendeesRes.count || 0, accountsRes.count || 0),
    liveEvents: (liveDatedRes.count || 0) + (liveUndatedRes.count || 0),
    currency: 'GBP',
  };
}

async function fetchAlerts(counts) {
  return buildAlertsFromCounts(counts);
}

async function fetchAttentionQueue(sb, counts) {
  const [pendingOppsRes, claimDisputesRes, openReportsRes, reviewReportsRes, pendingClaimsRes] =
    await Promise.all([
      sb
        .from('business_opportunities')
        .select('id, title, host, created_at')
        .eq('approval_status', 'Pending Review')
        .order('created_at', { ascending: false })
        .limit(10),
      sb
        .from('organiser_claim_disputes')
        .select('id, organiser_id, organiser_name, profile_email, reporter_email, notes, created_at')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(10),
      sb
        .from('listing_reports')
        .select('id, listing_type, listing_title, reason, details, reporter_email, created_at')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(10),
      sb
        .from('review_reports')
        .select('id, review_id, review_snippet, reason, details, reporter_email, created_at')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(10),
      sb
        .from('organisers')
        .select('id', { count: 'exact', head: true })
        .eq('ownership_claim_status', 'pending'),
    ]);

  const pendingOpportunities = (pendingOppsRes.data || []).map((o) => ({
    id: o.id,
    title: String(o.title || '').trim(),
    host: String(o.host || '').trim() || '—',
    createdAt: o.created_at,
  }));
  const openClaimDisputes = (claimDisputesRes.data || []).map((d) => ({
    id: d.id,
    organiserId: d.organiser_id,
    organiserName: String(d.organiser_name || '').trim() || 'Group profile',
    profileEmail: String(d.profile_email || '').trim(),
    reporterEmail: String(d.reporter_email || '').trim(),
    notes: String(d.notes || '').trim(),
    createdAt: d.created_at,
  }));
  const openListingReportItems = (openReportsRes.error ? [] : openReportsRes.data || []).map((r) => ({
    id: r.id,
    listingType: r.listing_type,
    title: String(r.listing_title || '').trim() || '—',
    reason: r.reason,
    details: String(r.details || '').trim(),
    reporterEmail: r.reporter_email || '',
    time: r.created_at,
  }));
  const openReviewReportItems = (reviewReportsRes.error ? [] : reviewReportsRes.data || []).map((r) => ({
    id: r.id,
    reviewId: r.review_id,
    snippet: String(r.review_snippet || '').trim(),
    reason: r.reason,
    details: String(r.details || '').trim(),
    reporterEmail: r.reporter_email || '',
    time: r.created_at,
  }));
  const pendingOwnershipClaims = pendingClaimsRes.error ? 0 : pendingClaimsRes.count || 0;
  const action = counts || {};

  return {
    pendingOpportunities,
    pendingOpportunitiesTotal: action.pendingOpportunities || 0,
    incompleteOrganisers: action.incompleteOrganisers || 0,
    spamReviews: action.spamReviews || 0,
    openClaimDisputes,
    openListingReports: action.openListingReports || 0,
    openListingReportItems,
    openReviewReports: action.openReviewReports || 0,
    openReviewReportItems,
    pendingOwnershipClaims,
    totalCount: sumAdminNotificationCounts(action),
  };
}

async function fetchActivity(sb) {
  const items = [];

  const [eventsRes, regsRes, reviewsRes, orgRes, disputesRes, reportsRes] = await Promise.all([
    sb
      .from('events')
      .select('title, approval_status, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    sb
      .from('registrations')
      .select('payment_status, amount_paid, created_at, events(title), attendees(name, email)')
      .order('created_at', { ascending: false })
      .limit(50),
    sb
      .from('reviews')
      .select('rating, created_at, events(title), attendees(name, email)')
      .order('created_at', { ascending: false })
      .limit(30),
    sb.from('organisers').select('name, created_at').order('created_at', { ascending: false }).limit(15),
    sb
      .from('organiser_claim_disputes')
      .select('organiser_name, reporter_email, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(15),
    sb
      .from('listing_reports')
      .select('listing_title, reason, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(15),
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

  (disputesRes.data || []).forEach((d) => {
    items.push({
      time: d.created_at,
      text: `Group profile disputed: ${String(d.organiser_name || 'profile').trim()} (reported by ${String(d.reporter_email || 'user').trim()})`,
      type: 'dispute',
    });
  });

  (reportsRes.data || []).forEach((r) => {
    items.push({
      time: r.created_at,
      text: `Listing reported: ${String(r.listing_title || 'listing').trim()} — ${String(r.reason || 'report').trim()}`,
      type: 'report',
    });
  });

  return items
    .filter((i) => i.time && !isTestActivityText(i.text))
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 12);
}

async function fetchUsers(sb) {
  const [accountsRes, attendeesRes, organisersRes, authRes] = await Promise.all([
    sb.from('hub_accounts').select('user_id, role, display_name, hub_view, emails_enabled'),
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
      organiserId: org?.id || null,
      name: acc.display_name || org?.name || att?.name || auth?.user_metadata?.full_name || '—',
      email: auth?.email || att?.email || org?.email || '—',
      role,
      city: org?.city || att?.location || '—',
      postcode: '—',
      status: 'Active',
      featured: Boolean(org?.featured),
      emailsEnabled: acc.emails_enabled !== false,
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

function mapEventToListing(e, soldByEvent) {
  const sold = soldByEvent.get(e.id) || 0;
  const approvalStatus = String(e.approval_status || '').trim();
  const status = listingStatusLabel(approvalStatus);
  return {
    id: e.id,
    title: String(e.title || '').trim(),
    type: String(e.event_type || 'Event').trim(),
    organiser: e.organisers?.name || '—',
    city: e.city || '—',
    status,
    approvalStatus,
    pending: false,
    sold,
    capacity: null,
  };
}

async function fetchModeration(sb) {
  const eventSelect =
    'id, title, event_type, city, approval_status, organiser_id, organisers(name)';

  const [eventsRes, reviewsRes, regCountsRes, reportsRes, reviewReportsRes] = await Promise.all([
    sb.from('events').select(eventSelect).order('created_at', { ascending: false }).limit(80),
    sb
      .from('reviews')
      .select('id, rating, review_text, created_at, events(title), attendees(name, email)')
      .order('created_at', { ascending: false })
      .limit(30),
    sb.from('registrations').select('event_id'),
    sb
      .from('listing_reports')
      .select(
        'id, listing_type, listing_title, reason, details, reporter_email, created_at, status, event_id, organiser_id, events(slug), organisers(slug)'
      )
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(30),
    sb
      .from('review_reports')
      .select('id, review_id, review_snippet, reason, details, reporter_email, created_at, status')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  if (eventsRes.error) throw new Error(eventsRes.error.message);
  if (reviewsRes.error) throw new Error(reviewsRes.error.message);

  const soldByEvent = new Map();
  (regCountsRes.data || []).forEach((r) => {
    if (!r.event_id) return;
    soldByEvent.set(r.event_id, (soldByEvent.get(r.event_id) || 0) + 1);
  });

  const listings = (eventsRes.data || []).map((e) => mapEventToListing(e, soldByEvent));

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

  const listingReports = (reportsRes.error ? [] : reportsRes.data || []).map((r) => {
    const title = String(r.listing_title || '').trim() || '—';
    const eventId = r.event_id || null;
    const organiserId = r.organiser_id || null;
    const eventSlug = r.events?.slug ? String(r.events.slug).trim() : '';
    const organiserSlug = r.organisers?.slug ? String(r.organisers.slug).trim() : '';
    let viewUrl = null;
    let adminUrl = null;
    if (r.listing_type === 'event' && eventId) {
      viewUrl = eventSlug
        ? `../events/event.html?slug=${encodeURIComponent(eventSlug)}`
        : `../events/event.html?id=${encodeURIComponent(eventId)}`;
      adminUrl = `#cleanup/events?q=${encodeURIComponent(title)}`;
    } else if (r.listing_type === 'organiser' && organiserId) {
      viewUrl = organiserSlug
        ? `../events/organiser.html?slug=${encodeURIComponent(organiserSlug)}`
        : `../events/organiser.html?id=${encodeURIComponent(organiserId)}`;
      adminUrl = `#cleanup/groups?organiser=${encodeURIComponent(organiserId)}`;
    }
    return {
      id: r.id,
      listingType: r.listing_type,
      title,
      reason: r.reason,
      details: String(r.details || '').trim(),
      reporterEmail: r.reporter_email || '',
      time: r.created_at,
      status: r.status,
      eventId,
      organiserId,
      viewUrl,
      adminUrl,
      canUnpublish: Boolean(eventId || organiserId),
    };
  });

  const reviewReports = (reviewReportsRes.error ? [] : reviewReportsRes.data || []).map((r) => ({
    id: r.id,
    reviewId: r.review_id,
    snippet: String(r.review_snippet || '').trim(),
    reason: r.reason,
    details: String(r.details || '').trim(),
    reporterEmail: r.reporter_email || '',
    time: r.created_at,
    status: r.status,
  }));

  return {
    listings,
    reviews,
    listingReports,
    reviewReports,
    listingReportsError: reportsRes.error ? reportsRes.error.message : null,
    reviewReportsError: reviewReportsRes.error ? reviewReportsRes.error.message : null,
  };
}

async function fetchFinancials(sb) {
  const [orgsRes, regsRes, payoutsRes] = await Promise.all([
    sb.from('organisers').select('id, name, stripe_account_id, payout_email').order('name'),
    sb
      .from('registrations')
      .select('created_at, payment_status, amount_paid, organisers(name)')
      .order('created_at', { ascending: false })
      .limit(40),
    sb
      .from('organiser_payouts')
      .select(
        'id, status, amount, amount_net, amount_gross, requested_at, created_at, event_id, events(title, organisers(name))'
      )
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  if (orgsRes.error) throw new Error(orgsRes.error.message);
  if (regsRes.error) throw new Error(regsRes.error.message);
  if (payoutsRes.error) throw new Error(payoutsRes.error.message);

  const revenueByOrg = new Map();
  (regsRes.data || [])
    .filter((r) => r.payment_status === 'Paid')
    .forEach((r) => {
      const name = r.organisers?.name || 'Unknown organiser';
      revenueByOrg.set(name, (revenueByOrg.get(name) || 0) + registrationTicketRevenue(r));
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

  const payoutStatusLabels = {
    pending_review: 'Pending review',
    approved: 'Approved',
    paid: 'Paid',
    held: 'Held',
  };

  const payoutQueue = (payoutsRes.data || []).map((p) => {
    const net = p.amount_net != null ? Number(p.amount_net) : Number(p.amount) || 0;
    return {
      id: p.id,
      status: p.status || 'pending_review',
      statusLabel: payoutStatusLabels[p.status] || p.status,
      amount: net > 0 ? `£${round2(net).toFixed(2)}` : '—',
      amountNet: net,
      eventId: p.event_id,
      eventTitle: p.events?.title || '—',
      organiser: p.events?.organisers?.name || '—',
      requestedAt: p.requested_at || p.created_at,
    };
  });

  return {
    stripeAccounts,
    payoutQueue,
    automationLog,
  };
}

const DEFAULT_CMS_SLOT = 'events_sponsor_hub';
const { buildSponsorRow, normalizeSponsorBlock } = require('./cms-sponsor-fields');

async function fetchSponsorBlock(sb, slot) {
  const key = String(slot || DEFAULT_CMS_SLOT).trim() || DEFAULT_CMS_SLOT;
  const res = await sb.from('cms_blocks').select('*').eq('slot', key).maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return normalizeSponsorBlock(res.data);
}

async function saveSponsorBlock(sb, payload) {
  const key = String(payload.slot || DEFAULT_CMS_SLOT).trim() || DEFAULT_CMS_SLOT;
  const existing = await fetchSponsorBlock(sb, key);
  if (!String(payload.logo_url || '').trim() && existing) {
    payload.logo_url = existing.logo_url || existing.image_url || '';
  }
  const row = buildSponsorRow({ ...payload, slot: key });
  const res = await sb.from('cms_blocks').upsert(row, { onConflict: 'slot' }).select().single();
  if (res.error) throw new Error(res.error.message);
  return normalizeSponsorBlock(res.data);
}

async function copySponsorBlock(sb, fromSlot, toSlot) {
  const source = await fetchSponsorBlock(sb, fromSlot);
  if (!source) {
    const err = new Error('source_not_found');
    err.code = 'source_not_found';
    throw err;
  }
  return saveSponsorBlock(sb, {
    slot: toSlot,
    title: source.title || source.subtitle || '',
    body: source.body || '',
    cta_label: source.cta_label || 'Visit website',
    cta_url: source.cta_url || '',
    cta_color: source.cta_color || '',
    logo_url: source.logo_url || source.image_url || '',
    company_name: source.company_name || '',
    active: source.active !== false,
  });
}

async function getAdminSponsor(slot) {
  if (!isSupabaseConfigured()) {
    return { configured: false, provider: 'supabase', block: null, slot: slot || DEFAULT_CMS_SLOT };
  }
  const sb = getSupabaseAdmin();
  const key = String(slot || DEFAULT_CMS_SLOT).trim() || DEFAULT_CMS_SLOT;
  const block = await fetchSponsorBlock(sb, key);
  return { configured: true, provider: 'supabase', block, slot: key, updatedAt: new Date().toISOString() };
}

async function resolveClaimDispute(disputeId) {
  const id = String(disputeId || '').trim();
  if (!id) {
    const err = new Error('missing_dispute_id');
    err.status = 400;
    throw err;
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('organiser_claim_disputes')
    .update({ status: 'resolved' })
    .eq('id', id)
    .eq('status', 'open')
    .select('id, organiser_id, organiser_name')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    const err = new Error('dispute_not_found');
    err.status = 404;
    throw err;
  }
  return data;
}

async function clearDisputedProfileEmail(disputeId) {
  const id = String(disputeId || '').trim();
  if (!id) {
    const err = new Error('missing_dispute_id');
    err.status = 400;
    throw err;
  }
  const sb = getSupabaseAdmin();
  const { data: dispute, error: disputeErr } = await sb
    .from('organiser_claim_disputes')
    .select('id, organiser_id, status')
    .eq('id', id)
    .eq('status', 'open')
    .maybeSingle();
  if (disputeErr) throw new Error(disputeErr.message);
  if (!dispute) {
    const err = new Error('dispute_not_found');
    err.status = 404;
    throw err;
  }

  if (dispute.organiser_id) {
    const { error: updateErr } = await sb
      .from('organisers')
      .update({
        email: null,
        contact_email: null,
        supabase_user_id: null,
        organiser_account_id: null,
        ownership_claim_status: null,
        ownership_claimed_at: null,
        ownership_disputed_at: null,
        ownership_disputed_by_email: null,
      })
      .eq('id', dispute.organiser_id);
    if (updateErr) throw new Error(updateErr.message);
  }

  return resolveClaimDispute(id);
}

async function getAdminDashboard() {
  if (!isSupabaseConfigured()) {
    return { configured: false, provider: 'supabase' };
  }
  const sb = getSupabaseAdmin();
  const actionCounts = await fetchAdminActionCounts(sb);
  const [metrics, activity, attention] = await Promise.all([
    fetchDashboardMetrics(sb),
    fetchActivity(sb),
    fetchAttentionQueue(sb, actionCounts),
  ]);
  const alerts = buildAlertsFromCounts(actionCounts);
  return {
    configured: true,
    provider: 'supabase',
    metrics,
    alerts,
    activity,
    attention,
    actionCounts,
    notificationCount: sumAdminNotificationCounts(actionCounts),
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
    return {
      configured: false,
      provider: 'supabase',
      listings: [],
      reviews: [],
      listingReports: [],
      reviewReports: [],
    };
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
  copySponsorBlock,
  fetchSponsorBlock,
  resolveClaimDispute,
  clearDisputedProfileEmail,
  sumAdminNotificationCounts,
};
