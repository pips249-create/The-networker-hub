/**
 * Member list — per organiser page access for members_only tickets.
 */
const { getSupabaseAdmin } = require('./supabase');
const { isMembersOnlyTicket } = require('./ticket-visibility');
const { ticketRowToTier, fetchRegistrationCountsByTicket } = require('./supabase-events');
const { sendTemplatedEmail } = require('./send-template-email');
const {
  siteBase,
  hubAccountUrl,
  organiserPublicUrl,
  eventPublicUrl,
  legalPolicyUrl,
  contactUrl,
  logoNavUrl,
  logoFooterUrl,
  browseEventsUrl,
} = require('./hub-email-urls');
const { formatEventDateTime } = require('./favourite-sales-emails');
const { emailGreetingName } = require('./email-display-name');

const ROSTER_STATUS_ACTIVE = 'active';
const ROSTER_STATUS_REMOVED = 'removed';

function normalizeRosterEmail(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase();
}

function parseExpiresAt(raw) {
  if (raw == null || raw === '') return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function rosterRowIsActive(row, now = new Date()) {
  if (!row || String(row.status || '') !== ROSTER_STATUS_ACTIVE) return false;
  if (!row.expires_at) return true;
  const exp = new Date(String(row.expires_at) + 'T23:59:59');
  return !Number.isNaN(exp.getTime()) && exp.getTime() >= now.getTime();
}

function daysUntilExpiry(expiresAt, now = new Date()) {
  if (!expiresAt) return null;
  const exp = new Date(String(expiresAt) + 'T23:59:59');
  if (Number.isNaN(exp.getTime())) return null;
  const ms = exp.getTime() - now.getTime();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

async function resolveAttendeeIdByEmail(sb, email) {
  const em = normalizeRosterEmail(email);
  if (!em) return null;
  const { data, error } = await sb.from('attendees').select('id').eq('email', em).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id || null;
}

async function getActiveRosterMembership(sb, { organiserId, email }) {
  const orgId = String(organiserId || '').trim();
  const em = normalizeRosterEmail(email);
  if (!orgId || !em) {
    return { active: false, row: null };
  }
  const { data, error } = await sb
    .from('organiser_member_roster')
    .select('*')
    .eq('organiser_id', orgId)
    .eq('status', ROSTER_STATUS_ACTIVE)
    .eq('email', em)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const active = rosterRowIsActive(data);
  return { active, row: data || null };
}

async function assertMembersOnlyBookingAllowed(sb, { organiserId, email }) {
  const orgId = String(organiserId || '').trim();
  const em = normalizeRosterEmail(email);
  if (!orgId || !em) {
    const err = new Error('members_only_not_eligible');
    err.status = 403;
    throw err;
  }
  const { data, error } = await sb
    .from('organiser_member_roster')
    .select('*')
    .eq('organiser_id', orgId)
    .eq('status', ROSTER_STATUS_ACTIVE)
    .eq('email', em)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    const err = new Error('members_only_not_eligible');
    err.status = 403;
    throw err;
  }
  if (!rosterRowIsActive(data)) {
    const err = new Error('membership_expired');
    err.status = 403;
    throw err;
  }
  return { active: true, row: data };
}

async function ensureOrganiserFavouritesForRoster(sb, attendeeId, organiserIds) {
  const attId = String(attendeeId || '').trim();
  const ids = [...new Set((organiserIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!attId || !ids.length) return;

  for (const organiserId of ids) {
    const existing = await sb
      .from('organiser_favourites')
      .select('id')
      .eq('attendee_id', attId)
      .eq('organiser_id', organiserId)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data?.id) continue;
    const ins = await sb
      .from('organiser_favourites')
      .insert({ attendee_id: attId, organiser_id: organiserId, notify_email: true });
    if (ins.error) throw new Error(ins.error.message);
  }
}

async function fetchNextUpcomingEventForOrganiser(sb, organiserId) {
  const orgId = String(organiserId || '').trim();
  if (!orgId) return null;
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from('events')
    .select('id, title, slug, starts_at, city, venue, location_label')
    .eq('organiser_id', orgId)
    .eq('status', 'published')
    .eq('approval_status', 'Approved')
    .gte('starts_at', now)
    .order('starts_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

function buildRosterUpcomingEventSection(eventRow) {
  if (!eventRow) return '';
  const { event_date, event_time } = formatEventDateTime(eventRow.starts_at);
  const location =
    String(eventRow.location_label || eventRow.venue || eventRow.city || '').trim() ||
    'See event page';
  const timeLine = event_time ? event_date + ' · ' + event_time : event_date;
  return (
    '<tr><td style="padding:0 40px 20px;text-align:center;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#1c2040;border-radius:16px;">' +
    '<tr><td style="padding:22px 24px;text-align:center;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Next meeting</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:18px;font-weight:600;color:#ffffff;margin:0 0 6px;line-height:1.35;">' +
    String(eventRow.title || 'Upcoming event').replace(/</g, '&lt;') +
    '</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;color:rgba(255,255,255,0.75);margin:0;">' +
    timeLine.replace(/</g, '&lt;') +
    (location ? ' · ' + location.replace(/</g, '&lt;') : '') +
    '</p></td></tr></table></td></tr>'
  );
}

function loginUrlWithNext(site, email, nextUrl) {
  return (
    site +
    '/login?email=' +
    encodeURIComponent(email) +
    '&next=' +
    encodeURIComponent(nextUrl)
  );
}

async function sendMemberRosterInviteEmail({
  organiserRow,
  memberEmail,
  memberName,
  rosterRowId,
  attendeeId,
}) {
  const email = normalizeRosterEmail(memberEmail);
  if (!email || !organiserRow?.id) return { sent: false };

  const sb = getSupabaseAdmin();
  const attId = attendeeId || (await resolveAttendeeIdByEmail(sb, email));
  const isExistingUser = Boolean(attId);
  const nextEvent = await fetchNextUpcomingEventForOrganiser(sb, organiserRow.id);

  const site = siteBase();
  const organiserUrl = organiserPublicUrl(organiserRow, site);
  const organiserName = String(organiserRow.name || 'your networking group').trim();
  const destinationUrl = nextEvent ? eventPublicUrl(nextEvent, site) : organiserUrl;
  const sharedVars = {
    user_name: emailGreetingName(memberName, email),
    user_email: email,
    organiser_name: organiserName,
    organiser_url: organiserUrl,
    hub_account_url: hubAccountUrl(site),
    site_url: site,
    logo_url: logoNavUrl(site),
    logo_footer_url: logoFooterUrl(site),
    privacy_url: legalPolicyUrl(site, 'privacy'),
    terms_url: legalPolicyUrl(site, 'terms'),
    contact_url: contactUrl(site),
  };

  let slug;
  let variables;
  if (isExistingUser) {
    const { event_date, event_time } = formatEventDateTime(nextEvent?.starts_at);
    slug = 'member_roster_existing';
    variables = {
      ...sharedVars,
      hub_groups_url: hubAccountUrl(site) + '#saved',
      cta_url: loginUrlWithNext(site, email, destinationUrl),
      cta_label: nextEvent ? 'Book member tickets' : 'View upcoming meetings',
      upcoming_event_section: buildRosterUpcomingEventSection(nextEvent),
      event_name: String(nextEvent?.title || '').trim(),
      event_date: event_date || '',
      event_time: event_time || '',
      event_location: String(
        nextEvent?.location_label || nextEvent?.venue || nextEvent?.city || ''
      ).trim(),
      event_url: nextEvent ? eventPublicUrl(nextEvent, site) : organiserUrl,
    };
  } else {
    slug = 'member_roster_invite';
    variables = {
      ...sharedVars,
      register_url:
        site +
        '/register?email=' +
        encodeURIComponent(email) +
        '&next=' +
        encodeURIComponent(destinationUrl),
      upcoming_event_section: buildRosterUpcomingEventSection(nextEvent),
    };
  }

  try {
    await sendTemplatedEmail({
      slug,
      to: email,
      variables,
    });
  } catch (e) {
    if (e.code === 'emails_disabled' || /emails_disabled/i.test(String(e.message || ''))) {
      return { sent: false, skipped: 'emails_disabled' };
    }
    throw e;
  }

  if (rosterRowId) {
    await sb
      .from('organiser_member_roster')
      .update({ invite_sent_at: new Date().toISOString() })
      .eq('id', rosterRowId);
  }

  return { sent: true, template: slug, existingUser: isExistingUser };
}

async function claimRosterEntriesForAttendee(sb, { email, attendeeId }) {
  const em = normalizeRosterEmail(email);
  const attId = String(attendeeId || '').trim();
  if (!em || !attId) return { claimed: 0 };
  const today = new Date().toISOString().slice(0, 10);

  const pendingRes = await sb
    .from('organiser_member_roster')
    .select('id, organiser_id')
    .eq('status', ROSTER_STATUS_ACTIVE)
    .eq('email', em)
    .or(`expires_at.is.null,expires_at.gte.${today}`)
    .is('claimed_at', null);
  if (pendingRes.error) throw new Error(pendingRes.error.message);

  const now = new Date().toISOString();
  const { data, error } = await sb
    .from('organiser_member_roster')
    .update({
      attendee_id: attId,
      claimed_at: now,
      updated_at: now,
    })
    .eq('status', ROSTER_STATUS_ACTIVE)
    .eq('email', em)
    .or(`expires_at.is.null,expires_at.gte.${today}`)
    .is('claimed_at', null)
    .select('id, organiser_id');
  if (error) throw new Error(error.message);

  const organiserIds = [
    ...new Set((data || []).map((row) => row.organiser_id).filter(Boolean)),
  ];
  const allActiveRes = await sb
    .from('organiser_member_roster')
    .select('organiser_id')
    .eq('status', ROSTER_STATUS_ACTIVE)
    .eq('email', em)
    .or(`expires_at.is.null,expires_at.gte.${today}`);
  if (allActiveRes.error) throw new Error(allActiveRes.error.message);
  const allOrganiserIds = [
    ...new Set((allActiveRes.data || []).map((row) => row.organiser_id).filter(Boolean)),
  ];
  await ensureOrganiserFavouritesForRoster(sb, attId, allOrganiserIds);

  return { claimed: (data || []).length, organiserIds };
}

async function listRosterForOrganiser(organiserId, { status } = {}) {
  const sb = getSupabaseAdmin();
  const orgId = String(organiserId || '').trim();
  if (!orgId) return [];

  let q = sb
    .from('organiser_member_roster')
    .select('*')
    .eq('organiser_id', orgId)
    .order('name', { ascending: true, nullsFirst: false })
    .order('email', { ascending: true });

  const statusFilter = String(status || '').trim().toLowerCase();
  if (statusFilter && statusFilter !== 'all') {
    q = q.eq('status', statusFilter);
  } else if (!statusFilter) {
    q = q.eq('status', ROSTER_STATUS_ACTIVE);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map(rosterRowToClient);
}

const ROSTER_PAGE_SIZE_DEFAULT = 25;
const ROSTER_PAGE_SIZE_MAX = 100;

async function getBookedEmailsForEvent(sb, organiserId, eventId) {
  const { data: regs, error } = await sb
    .from('registrations')
    .select('application_status, payment_status, attendees(email)')
    .eq('event_id', eventId)
    .eq('organiser_id', organiserId)
    .is('cancelled_at', null);
  if (error) throw new Error(error.message);
  const bookedEmails = new Set();
  (regs || []).forEach((row) => {
    const app = String(row.application_status || 'Approved');
    const pay = String(row.payment_status || '');
    if (app === 'Denied' || pay === 'Refunded') return;
    const em = normalizeRosterEmail(row.attendees?.email);
    if (em) bookedEmails.add(em);
  });
  return bookedEmails;
}

function memberMatchesSearch(member, search) {
  const q = String(search || '').trim().toLowerCase();
  if (!q) return true;
  const hay = ((member.name || '') + ' ' + (member.email || '')).toLowerCase();
  return hay.includes(q);
}

/**
 * Paginated roster for dashboard lazy loading.
 */
async function listRosterPage(organiserId, options = {}) {
  const sb = getSupabaseAdmin();
  const orgId = String(organiserId || '').trim();
  if (!orgId) return { members: [], total: 0, totalActive: 0 };

  const limit = Math.min(
    Math.max(Number(options.limit) || ROSTER_PAGE_SIZE_DEFAULT, 1),
    ROSTER_PAGE_SIZE_MAX
  );
  const offset = Math.max(Number(options.offset) || 0, 0);
  const search = String(options.search || '').trim();
  const filter = String(options.filter || 'all').trim().toLowerCase();
  const eventId = String(options.eventId || '').trim();
  const enrichBookings = options.enrichBookings !== false;

  const bookingFilters = ['booked', 'not_booked', 'has_bookings', 'no_bookings'];
  if (bookingFilters.includes(filter)) {
    let filtered = await listRosterForOrganiser(orgId, { status: 'active' });
    if (filter === 'booked' || filter === 'not_booked') {
      if (!eventId) return { members: [], total: 0, totalActive: 0 };
      const bookedEmails = await getBookedEmailsForEvent(sb, orgId, eventId);
      filtered = filtered.filter((m) => {
        const isBooked = bookedEmails.has(m.email);
        return filter === 'booked' ? isBooked : !isBooked;
      });
    } else {
      const index = await buildMemberBookingIndex(orgId);
      filtered = filtered.filter((m) => {
        const has = (index.get(m.email)?.total || 0) > 0;
        return filter === 'has_bookings' ? has : !has;
      });
    }
    if (search) {
      filtered = filtered.filter((m) => memberMatchesSearch(m, search));
    }
    const total = filtered.length;
    const slice = filtered.slice(offset, offset + limit);
    const members = enrichBookings ? await enrichMembersWithBookings(orgId, slice) : slice;
    const totalActive = await countActiveRosterMembers(orgId);
    return { members, total, totalActive };
  }

  let q = sb
    .from('organiser_member_roster')
    .select('*', { count: 'exact' })
    .eq('organiser_id', orgId)
    .eq('status', ROSTER_STATUS_ACTIVE);

  if (search) {
    const term = search.replace(/[%_,]/g, ' ').trim();
    if (term) {
      q = q.or(`email.ilike.%${term}%,name.ilike.%${term}%`);
    }
  }

  if (filter === 'claimed') {
    q = q.or('claimed_at.not.is.null,attendee_id.not.is.null');
  } else if (filter === 'unclaimed') {
    q = q.is('claimed_at', null).is('attendee_id', null);
  } else if (filter === 'expiring') {
    const today = new Date().toISOString().slice(0, 10);
    const in14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    q = q.not('expires_at', 'is', null).gte('expires_at', today).lte('expires_at', in14);
  }

  q = q
    .order('name', { ascending: true, nullsFirst: false })
    .order('email', { ascending: true })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  const rows = (data || []).map(rosterRowToClient);
  const members = enrichBookings
    ? await enrichMembersWithBookings(orgId, rows, { emails: rows.map((m) => m.email) })
    : rows;
  const totalActive = await countActiveRosterMembers(orgId);
  return { members, total: Number(count) || rows.length, totalActive };
}

async function countActiveRosterMembers(organiserId) {
  const sb = getSupabaseAdmin();
  const orgId = String(organiserId || '').trim();
  if (!orgId) return 0;
  const { count, error } = await sb
    .from('organiser_member_roster')
    .select('id', { count: 'exact', head: true })
    .eq('organiser_id', orgId)
    .eq('status', ROSTER_STATUS_ACTIVE);
  if (error) throw new Error(error.message);
  return Number(count) || 0;
}

function rosterRowToClient(row) {
  const expiresAt = row.expires_at || null;
  const days = daysUntilExpiry(expiresAt);
  return {
    id: row.id,
    organiserId: row.organiser_id,
    email: normalizeRosterEmail(row.email),
    name: String(row.name || '').trim(),
    expiresAt,
    status: String(row.status || ROSTER_STATUS_ACTIVE),
    attendeeId: row.attendee_id || null,
    claimedAt: row.claimed_at || null,
    invitedAt: row.invited_at || null,
    inviteSentAt: row.invite_sent_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    membershipActive: rosterRowIsActive(row),
    daysUntilExpiry: days,
    expiringSoon: days != null && days >= 0 && days <= 14,
  };
}

async function upsertRosterMember(organiserId, payload, options) {
  const opts = options || {};
  const sb = getSupabaseAdmin();
  const orgId = String(organiserId || '').trim();
  const email = normalizeRosterEmail(payload.email);
  const name = String(payload.name || '').trim() || null;
  const expiresAt = parseExpiresAt(payload.expiresAt ?? payload.expires_at);
  const status = String(payload.status || ROSTER_STATUS_ACTIVE).trim();
  const sendInvite = opts.sendInvite !== false && payload.sendInvite !== false;
  const resendInvite = Boolean(opts.resendInvite || payload.resendInvite);
  const skipSideEffects = Boolean(opts.skipSideEffects);

  if (!orgId || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const err = new Error('invalid_roster_member');
    err.status = 400;
    throw err;
  }

  const attendeeId = await resolveAttendeeIdByEmail(sb, email);
  const now = new Date().toISOString();
  const row = {
    organiser_id: orgId,
    email,
    name,
    expires_at: expiresAt,
    status: status === ROSTER_STATUS_REMOVED ? ROSTER_STATUS_REMOVED : ROSTER_STATUS_ACTIVE,
    attendee_id: attendeeId,
    updated_at: now,
    ...(attendeeId ? { claimed_at: now } : {}),
  };

  const { data: existing } = await sb
    .from('organiser_member_roster')
    .select('id, status, claimed_at, invite_sent_at')
    .eq('organiser_id', orgId)
    .eq('email', email)
    .maybeSingle();

  let saved;
  const isNew = !existing?.id;

  if (existing?.id) {
    if (existing.claimed_at) row.claimed_at = existing.claimed_at;
    const { data, error } = await sb
      .from('organiser_member_roster')
      .update(row)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    saved = data;
  } else {
    row.invited_at = now;
    const { data, error } = await sb
      .from('organiser_member_roster')
      .insert(row)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    saved = data;
  }

  if (attendeeId && row.status === ROSTER_STATUS_ACTIVE) {
    await ensureOrganiserFavouritesForRoster(sb, attendeeId, [orgId]);
  }

  let inviteResult = { sent: false };
  const shouldInvite =
    sendInvite &&
    row.status === ROSTER_STATUS_ACTIVE &&
    (isNew || resendInvite || !existing?.invite_sent_at);
  if (shouldInvite) {
    const orgRes = await sb
      .from('organisers')
      .select('id, name, slug, photo_url')
      .eq('id', orgId)
      .maybeSingle();
    if (orgRes.error) throw new Error(orgRes.error.message);
    if (orgRes.data) {
      inviteResult = await sendMemberRosterInviteEmail({
        organiserRow: orgRes.data,
        memberEmail: email,
        memberName: name,
        rosterRowId: saved.id,
        attendeeId,
      });
    }
  }

  const becameActiveMember =
    !skipSideEffects &&
    saved.status === ROSTER_STATUS_ACTIVE &&
    rosterRowIsActive(saved) &&
    (isNew || String(existing?.status || '') === ROSTER_STATUS_REMOVED);
  if (becameActiveMember) {
    notifyRosterMemberOfUpcomingLiveEvents(orgId, rosterRowToClient(saved)).catch((err) => {
      console.error(
        '[member-roster] upcoming event notify failed',
        orgId,
        email,
        err?.message || err
      );
    });
  }

  return { member: rosterRowToClient(saved), invite: inviteResult };
}

async function removeRosterMember(organiserId, memberId) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('organiser_member_roster')
    .update({
      status: ROSTER_STATUS_REMOVED,
      updated_at: new Date().toISOString(),
    })
    .eq('organiser_id', organiserId)
    .eq('id', memberId)
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) {
    const err = new Error('roster_member_not_found');
    err.status = 404;
    throw err;
  }
  return { ok: true };
}

async function importRosterCsv(organiserId, rows, options) {
  const orgId = String(organiserId || '').trim();
  const sendInvite = options?.sendInvite === true;
  const { queueMemberRosterInvites } = require('./organiser-roster-email-queue');

  let ok = 0;
  let fail = 0;
  const errors = [];
  const savedMembers = [];
  const normalized = [];

  for (const row of rows || []) {
    const email = normalizeRosterEmail(row.email);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fail += 1;
      if (errors.length < 20) errors.push({ email: row.email, message: 'invalid_email' });
      continue;
    }
    normalized.push({
      email,
      name: String(row.name || '').trim() || null,
      expiresAt: parseExpiresAt(row.expiresAt ?? row.expires_at),
    });
  }

  for (const row of normalized) {
    try {
      const result = await upsertRosterMember(
        orgId,
        {
          email: row.email,
          name: row.name,
          expiresAt: row.expiresAt,
          sendInvite: false,
        },
        { sendInvite: false, skipSideEffects: true }
      );
      ok += 1;
      if (result.member) savedMembers.push(result.member);
    } catch (e) {
      fail += 1;
      if (errors.length < 20) {
        errors.push({ email: row.email, message: e.message });
      }
    }
  }

  let invitesQueued = 0;
  if (sendInvite && savedMembers.length) {
    const toInvite = savedMembers.filter((m) => m.status === ROSTER_STATUS_ACTIVE && m.email);
    const queued = await queueMemberRosterInvites(orgId, toInvite);
    invitesQueued = queued.queued || 0;
    if (invitesQueued > 0) {
      try {
        const { processDueRosterEmails } = require('./organiser-roster-email-queue');
        await processDueRosterEmails(getSupabaseAdmin(), { batchSize: 20 });
      } catch (err) {
        console.error('[member-roster] invite queue process failed', orgId, err?.message || err);
      }
    }
  }

  return {
    total: (rows || []).length,
    ok,
    fail,
    invitesSent: 0,
    invitesQueued,
    errors,
  };
}

function parseRosterCsv(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (!lines.length) return [];
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  const emailIdx = header.findIndex((h) => h === 'email' || h === 'e-mail');
  const nameIdx = header.findIndex((h) => h === 'name' || h === 'full name' || h === 'member name');
  const expiryIdx = header.findIndex((h) =>
    ['expires', 'expires_at', 'expiry', 'membership expiry', 'membership_expiry'].includes(h)
  );
  if (emailIdx < 0) throw new Error('CSV needs an email column');

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const email = cols[emailIdx];
    if (!email) continue;
    rows.push({
      email,
      name: nameIdx >= 0 ? cols[nameIdx] : '',
      expiresAt: expiryIdx >= 0 ? cols[expiryIdx] : null,
    });
  }
  return rows;
}

async function loadMemberTicketsForEvent(sb, eventId) {
  const { data: tickets, error } = await sb.from('tickets').select('*').eq('event_id', eventId);
  if (error) throw new Error(error.message);
  const memberRows = (tickets || []).filter(isMembersOnlyTicket);
  if (!memberRows.length) return [];
  const regCounts = await fetchRegistrationCountsByTicket(sb, memberRows);
  return memberRows.map((t) => ticketRowToTier(t, regCounts.get(t.id) || 0));
}

async function buildRosterReports(organiserId, { eventId, recentEventIds } = {}) {
  const sb = getSupabaseAdmin();
  const orgId = String(organiserId || '').trim();
  const roster = await listRosterForOrganiser(orgId, { status: 'all' });
  const activeRoster = roster.filter((r) => r.status === ROSTER_STATUS_ACTIVE);

  const claimed = activeRoster.filter((r) => r.claimedAt || r.attendeeId).length;
  const unclaimed = activeRoster.length - claimed;
  const expiringSoon = activeRoster.filter((r) => r.expiringSoon).length;
  const expired = activeRoster.filter((r) => !r.membershipActive && r.expiresAt).length;

  const reports = {
    rosterHealth: {
      totalActive: activeRoster.length,
      claimed,
      unclaimed,
      expiringSoon,
      expired,
    },
    membershipExpiry: {
      within14Days: activeRoster
        .filter((r) => r.expiringSoon)
        .map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          expiresAt: r.expiresAt,
          daysUntilExpiry: r.daysUntilExpiry,
        })),
    },
    bookedForEvent: null,
    eventAttendance: null,
    missedRecentMeetings: null,
  };

  const targetEventId = String(eventId || '').trim();
  if (targetEventId) {
    const { data: regs, error: regErr } = await sb
      .from('registrations')
      .select('id, attendee_id, attendees(email), application_status, payment_status, cancelled_at')
      .eq('event_id', targetEventId)
      .eq('organiser_id', orgId)
      .is('cancelled_at', null);
    if (regErr) throw new Error(regErr.message);

    const bookedEmails = new Set();
    (regs || []).forEach((row) => {
      const app = String(row.application_status || 'Approved');
      const pay = String(row.payment_status || '');
      if (app === 'Denied') return;
      if (pay === 'Refunded') return;
      const em = normalizeRosterEmail(row.attendees?.email);
      if (em) bookedEmails.add(em);
    });

    const booked = [];
    const notBooked = [];
    activeRoster.forEach((member) => {
      if (!member.membershipActive) return;
      const item = {
        id: member.id,
        name: member.name,
        email: member.email,
        claimedAt: member.claimedAt,
      };
      if (bookedEmails.has(member.email)) booked.push(item);
      else notBooked.push(item);
    });

    reports.bookedForEvent = {
      eventId: targetEventId,
      bookedCount: booked.length,
      notBookedCount: notBooked.length,
      booked,
      notBooked,
    };

    const rosterEmails = new Set(
      activeRoster.filter((m) => m.membershipActive).map((m) => m.email)
    );

    const { buildRegistrationRelationshipMap, relationshipForRegistration } = require('./organiser-attendee-relationship');
    const relMap = buildRegistrationRelationshipMap(regs || []);
    let newCount = 0;
    let returningCount = 0;
    (regs || []).forEach((row) => {
      const em = normalizeRosterEmail(row.attendees?.email);
      if (!em || !rosterEmails.has(em)) return;
      const rel = relationshipForRegistration(row, relMap);
      if (rel.groupRelationship === 'new') newCount += 1;
      else if (rel.groupRelationship === 'returning') returningCount += 1;
    });
    reports.eventAttendance = {
      eventId: targetEventId,
      newCount,
      returningCount,
      totalMemberBookings: newCount + returningCount,
      memberListOnly: true,
    };
  }

  const recentIds = (recentEventIds || []).filter(Boolean).slice(0, 12);
  if (recentIds.length) {
    const { data: recentRegs, error: recentErr } = await sb
      .from('registrations')
      .select('event_id, attendees(email), application_status, payment_status, cancelled_at')
      .in('event_id', recentIds)
      .eq('organiser_id', orgId)
      .is('cancelled_at', null);
    if (recentErr) throw new Error(recentErr.message);

    const bookedByEmail = new Map();
    (recentRegs || []).forEach((row) => {
      const app = String(row.application_status || 'Approved');
      const pay = String(row.payment_status || '');
      if (app === 'Denied' || pay === 'Refunded') return;
      const em = normalizeRosterEmail(row.attendees?.email);
      if (!em) return;
      if (!bookedByEmail.has(em)) bookedByEmail.set(em, new Set());
      bookedByEmail.get(em).add(row.event_id);
    });

    const missed = activeRoster
      .filter((m) => m.membershipActive)
      .map((member) => {
        const attended = bookedByEmail.get(member.email);
        const missedCount = recentIds.filter((id) => !(attended && attended.has(id))).length;
        return {
          id: member.id,
          name: member.name,
          email: member.email,
          missedCount,
          recentEventsChecked: recentIds.length,
        };
      })
      .filter((m) => m.missedCount > 0)
      .sort((a, b) => b.missedCount - a.missedCount);

    reports.missedRecentMeetings = {
      recentEventIds: recentIds,
      members: missed,
    };
  }

  return reports;
}

async function buildMemberBookingIndex(orgId, options) {
  const sb = getSupabaseAdmin();
  const emailFilter =
    options && options.emails
      ? new Set((options.emails || []).map(normalizeRosterEmail).filter(Boolean))
      : null;
  const { data: regs, error } = await sb
    .from('registrations')
    .select(
      'event_id, created_at, application_status, payment_status, cancelled_at, attendees(email)'
    )
    .eq('organiser_id', orgId)
    .is('cancelled_at', null);
  if (error) throw new Error(error.message);

  const eventIds = [...new Set((regs || []).map((row) => row.event_id).filter(Boolean))];
  const eventsById = new Map();
  for (let i = 0; i < eventIds.length; i += 80) {
    const chunk = eventIds.slice(i, i + 80);
    const { data: evs, error: evErr } = await sb
      .from('events')
      .select('id, title, starts_at')
      .in('id', chunk);
    if (evErr) throw new Error(evErr.message);
    (evs || []).forEach((ev) => eventsById.set(ev.id, ev));
  }

  const now = Date.now();
  const byEmail = new Map();

  (regs || []).forEach((row) => {
    const app = String(row.application_status || 'Approved');
    const pay = String(row.payment_status || '');
    if (app === 'Denied' || pay === 'Refunded') return;
    const email = normalizeRosterEmail(row.attendees?.email);
    if (!email || !row.event_id) return;
    if (emailFilter && !emailFilter.has(email)) return;
    const ev = eventsById.get(row.event_id) || {};
    const start = ev.starts_at ? new Date(ev.starts_at).getTime() : 0;
    const item = {
      eventId: row.event_id,
      title: String(ev.title || 'Event').trim(),
      startsAt: ev.starts_at || null,
      isUpcoming: start >= now,
    };
    if (!byEmail.has(email)) byEmail.set(email, []);
    byEmail.get(email).push(item);
  });

  const index = new Map();
  byEmail.forEach((bookings, email) => {
    bookings.sort((a, b) => {
      const ta = a.startsAt ? new Date(a.startsAt).getTime() : 0;
      const tb = b.startsAt ? new Date(b.startsAt).getTime() : 0;
      return tb - ta;
    });
    const unique = [];
    const seen = new Set();
    bookings.forEach((b) => {
      const key = String(b.eventId);
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(b);
    });
    index.set(email, {
      total: unique.length,
      upcoming: unique.filter((b) => b.isUpcoming),
      recent: unique.filter((b) => !b.isUpcoming),
      all: unique,
      latest: unique[0] || null,
    });
  });
  return index;
}

async function enrichMembersWithBookings(orgId, members, options) {
  const emails = (members || []).map((m) => m.email).filter(Boolean);
  const index = await buildMemberBookingIndex(orgId, { emails });
  return (members || []).map((m) => ({
    ...m,
    bookings: index.get(m.email) || {
      total: 0,
      upcoming: [],
      recent: [],
      all: [],
      latest: null,
    },
  }));
}

async function listRosterGroupsForAttendee(email) {
  const sb = getSupabaseAdmin();
  const em = normalizeRosterEmail(email);
  if (!em) return [];

  const { data, error } = await sb
    .from('organiser_member_roster')
    .select(
      'id, expires_at, claimed_at, invite_sent_at, status, organisers(id, name, slug, photo_url, industries, average_rating)'
    )
    .eq('status', ROSTER_STATUS_ACTIVE)
    .eq('email', em)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);

  return (data || []).map((row) => {
    const org = row.organisers || {};
    const industries = Array.isArray(org.industries) ? org.industries : [];
    const client = rosterRowToClient(row);
    return {
      ...client,
      name: client.name || String(org.name || '').trim() || em.split('@')[0],
      organiserName: String(org.name || 'Organiser').trim(),
      organiserSlug: String(org.slug || '').trim(),
      organiserPhotoUrl: String(org.photo_url || '').trim(),
      industry: industries[0] || '',
      rating: org.average_rating != null ? Number(org.average_rating) : null,
    };
  });
}

/**
 * Send one member-list new-event email and record dedupe row.
 * Returns 'sent' | 'skipped' | throws on hard failure.
 */
async function sendMemberRosterNewEventAlert(sb, { eventRow, organiser, member, alreadyAlerted }) {
  const eventId = String(eventRow?.id || '').trim();
  const organiserId = String(organiser?.id || eventRow?.organiser_id || '').trim();
  const memberId = String(member?.id || '').trim();
  if (!eventId || !organiserId || !memberId) return 'skipped';
  if (alreadyAlerted && alreadyAlerted.has(memberId)) return 'skipped';

  const email = normalizeRosterEmail(member.email);
  if (!email || !member.membershipActive) return 'skipped';

  const alertedRes = await sb
    .from('organiser_roster_listing_alerts')
    .select('id')
    .eq('roster_member_id', memberId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (alertedRes.error) throw new Error(alertedRes.error.message);
  if (alertedRes.data?.id) return 'skipped';

  const site = siteBase();
  const { event_date, event_time } = formatEventDateTime(eventRow.starts_at || eventRow.startsAt);
  const eventLocation =
    String(eventRow.location_label || eventRow.locationLabel || eventRow.venue || eventRow.city || '').trim() ||
    'See event page';
  const eventTimeSuffix = event_time ? ' · ' + event_time : '';
  const eventUrl = eventPublicUrl(eventRow, site);
  const organiserUrl = organiserPublicUrl(organiser, site);
  const organiserName = String(organiser.name || 'your networking group').trim();
  const hasAccount = Boolean(member.attendeeId || member.claimedAt);
  const ctaUrl = hasAccount
    ? loginUrlWithNext(site, email, eventUrl)
    : site +
      '/register?email=' +
      encodeURIComponent(email) +
      '&next=' +
      encodeURIComponent(eventUrl);
  const ctaLabel = hasAccount ? 'View member tickets' : 'Create account & view event';

  await sendTemplatedEmail({
    slug: 'member_roster_new_event',
    to: email,
    variables: {
      user_name: emailGreetingName(member.name, email),
      user_email: email,
      organiser_name: organiserName,
      organiser_url: organiserUrl,
      event_name: String(eventRow.title || 'Event').trim(),
      event_date: event_date || '',
      event_time: eventTimeSuffix,
      event_location: eventLocation,
      event_url: eventUrl,
      cta_url: ctaUrl,
      cta_label: ctaLabel,
      hub_account_url: hubAccountUrl(site),
      browse_events_url: browseEventsUrl(site),
      contact_url: contactUrl(site),
      privacy_url: legalPolicyUrl(site, 'privacy'),
      terms_url: legalPolicyUrl(site, 'terms'),
      site_url: site,
      logo_url: logoNavUrl(site),
      logo_footer_url: logoFooterUrl(site),
    },
  });

  await sb.from('organiser_roster_listing_alerts').insert({
    roster_member_id: memberId,
    event_id: eventId,
  });
  if (alreadyAlerted) alreadyAlerted.add(memberId);

  if (member.attendeeId) {
    try {
      const fav = await sb
        .from('organiser_favourites')
        .select('id')
        .eq('attendee_id', member.attendeeId)
        .eq('organiser_id', organiserId)
        .maybeSingle();
      if (fav.data?.id) {
        await sb.from('organiser_favourite_listing_alerts').upsert(
          {
            organiser_favourite_id: fav.data.id,
            event_id: eventId,
          },
          { onConflict: 'organiser_favourite_id,event_id', ignoreDuplicates: true }
        );
      }
    } catch {
      /* non-fatal */
    }
  }

  return 'sent';
}

/**
 * When someone joins (or rejoins) a member list, email them about live upcoming events
 * they have not been notified about yet.
 */
async function notifyRosterMemberOfUpcomingLiveEvents(organiserId, member) {
  const result = { sent: 0, skipped: 0, errors: [] };
  const orgId = String(organiserId || '').trim();
  if (!orgId || !member?.id || !member.email || !member.membershipActive) return result;

  const sb = getSupabaseAdmin();
  const { data: organiser, error: orgErr } = await sb
    .from('organisers')
    .select('id, name, slug')
    .eq('id', orgId)
    .maybeSingle();
  if (orgErr) throw new Error(orgErr.message);
  if (!organiser) return result;

  const now = new Date().toISOString();
  const { data: events, error: eventsErr } = await sb
    .from('events')
    .select(
      'id, title, slug, starts_at, status, approval_status, venue, city, location_label, organiser_id, published_at'
    )
    .eq('organiser_id', orgId)
    .eq('status', 'published')
    .eq('approval_status', 'Approved')
    .gte('starts_at', now)
    .order('starts_at', { ascending: true })
    .limit(20);
  if (eventsErr) throw new Error(eventsErr.message);
  if (!(events || []).length) return result;

  for (const eventRow of events) {
    try {
      const outcome = await sendMemberRosterNewEventAlert(sb, {
        eventRow,
        organiser,
        member,
      });
      if (outcome === 'sent') result.sent += 1;
      else result.skipped += 1;
    } catch (e) {
      if (e.code === 'emails_disabled' || /emails_disabled/i.test(String(e.message || ''))) {
        result.skipped += 1;
        continue;
      }
      result.errors.push({
        event_id: eventRow.id,
        email: member.email,
        message: e.message || String(e),
      });
    }
  }

  return result;
}

/**
 * Email active member-list people when their organiser publishes an Approved event.
 * Deduped per (roster_member_id, event_id). Also marks favourite listing alerts so
 * the daily saved-organiser cron does not double-send to the same inbox.
 */
async function notifyRosterMembersOfPublishedEvent(eventRow) {
  const result = { sent: 0, skipped: 0, queued: 0, errors: [] };
  const eventId = String(eventRow?.id || '').trim();
  const organiserId = String(eventRow?.organiser_id || eventRow?.organiserId || '').trim();
  if (!eventId || !organiserId) return result;
  if (String(eventRow.status || '').trim() !== 'published') return result;
  if (String(eventRow.approval_status || eventRow.approvalStatus || '').trim() !== 'Approved') {
    return result;
  }

  const sb = getSupabaseAdmin();
  const { data: organiser, error: orgErr } = await sb
    .from('organisers')
    .select('id, name, slug')
    .eq('id', organiserId)
    .maybeSingle();
  if (orgErr) throw new Error(orgErr.message);
  if (!organiser) return result;

  const members = await listRosterForOrganiser(organiserId, { status: 'active' });
  const activeMembers = (members || []).filter((m) => m.membershipActive && m.email);
  if (!activeMembers.length) return result;

  const memberIds = activeMembers.map((m) => m.id);
  const alertedRes = await sb
    .from('organiser_roster_listing_alerts')
    .select('roster_member_id')
    .eq('event_id', eventId)
    .in('roster_member_id', memberIds);
  if (alertedRes.error) throw new Error(alertedRes.error.message);
  const already = new Set((alertedRes.data || []).map((r) => String(r.roster_member_id)));
  const toQueue = activeMembers.filter((m) => !already.has(m.id));
  result.skipped = activeMembers.length - toQueue.length;

  if (!toQueue.length) return result;

  const { queueNewEventAlerts } = require('./organiser-roster-email-queue');
  const queued = await queueNewEventAlerts(eventRow, toQueue);
  result.queued = queued.queued || 0;
  result.sent = result.queued;

  if (result.queued > 0) {
    try {
      const { processDueRosterEmails } = require('./organiser-roster-email-queue');
      const processed = await processDueRosterEmails(sb, { batchSize: 40 });
      result.sent = processed.sent || 0;
      result.skipped += processed.skipped || 0;
      if (Array.isArray(processed.errors) && processed.errors.length) {
        result.errors.push(...processed.errors.slice(0, 10));
      }
    } catch (err) {
      result.errors.push({ message: err.message || String(err) });
    }
  }

  return result;
}

/**
 * Batch membership stats for organiser dashboard chooser cards.
 */
async function buildRosterSummariesForOrganisers(organiserIds) {
  const ids = [...new Set((organiserIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  const map = new Map();
  ids.forEach((id) => map.set(id, { active: 0, unclaimed: 0, expiringSoon: 0 }));
  if (!ids.length) return map;

  const sb = getSupabaseAdmin();
  const CHUNK = 100;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const { data, error } = await sb
      .from('organiser_member_roster')
      .select('organiser_id, status, expires_at, claimed_at, attendee_id')
      .in('organiser_id', chunk)
      .eq('status', ROSTER_STATUS_ACTIVE);
    if (error) throw new Error(error.message);
    (data || []).forEach((row) => {
      if (!rosterRowIsActive(row)) return;
      const orgId = String(row.organiser_id || '').trim();
      const summary = map.get(orgId);
      if (!summary) return;
      summary.active += 1;
      if (!row.claimed_at && !row.attendee_id) summary.unclaimed += 1;
      const days = daysUntilExpiry(row.expires_at);
      if (days != null && days >= 0 && days <= 14) summary.expiringSoon += 1;
    });
  }
  return map;
}

/**
 * Email active members who have not booked a specific event.
 */
async function sendMemberRosterBookingReminders(organiserId, eventId) {
  const orgId = String(organiserId || '').trim();
  const targetEventId = String(eventId || '').trim();
  if (!orgId || !targetEventId) return { sent: 0, skipped: 0, queued: 0, errors: [] };

  const reports = await buildRosterReports(orgId, { eventId: targetEventId });
  const notBooked = reports.bookedForEvent?.notBooked || [];
  if (!notBooked.length) return { sent: 0, skipped: 0, queued: 0, errors: [] };

  const { queueBookingReminders } = require('./organiser-roster-email-queue');
  const queued = await queueBookingReminders(orgId, targetEventId, notBooked);
  return {
    sent: 0,
    queued: queued.queued || 0,
    skipped: 0,
    errors: [],
  };
}

async function queueUnclaimedMemberInvites(organiserId) {
  const orgId = String(organiserId || '').trim();
  if (!orgId) return { queued: 0 };
  const members = await listRosterForOrganiser(orgId, { status: 'active' });
  const unclaimed = (members || []).filter(
    (m) => m.email && !m.claimedAt && !m.attendeeId && m.membershipActive
  );
  if (!unclaimed.length) return { queued: 0 };
  const { queueMemberRosterInvites } = require('./organiser-roster-email-queue');
  return queueMemberRosterInvites(orgId, unclaimed);
}

module.exports = {
  ROSTER_STATUS_ACTIVE,
  ROSTER_STATUS_REMOVED,
  normalizeRosterEmail,
  rosterRowIsActive,
  getActiveRosterMembership,
  assertMembersOnlyBookingAllowed,
  claimRosterEntriesForAttendee,
  listRosterForOrganiser,
  listRosterPage,
  upsertRosterMember,
  removeRosterMember,
  importRosterCsv,
  parseRosterCsv,
  loadMemberTicketsForEvent,
  buildRosterReports,
  buildMemberBookingIndex,
  enrichMembersWithBookings,
  listRosterGroupsForAttendee,
  sendMemberRosterInviteEmail,
  sendMemberRosterNewEventAlert,
  rosterRowToClient,
  ensureOrganiserFavouritesForRoster,
  notifyRosterMembersOfPublishedEvent,
  notifyRosterMemberOfUpcomingLiveEvents,
  buildRosterSummariesForOrganisers,
  sendMemberRosterBookingReminders,
  queueUnclaimedMemberInvites,
};
