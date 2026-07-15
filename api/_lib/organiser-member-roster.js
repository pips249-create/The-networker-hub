/**
 * Member roster — per organiser page access for members_only tickets.
 */
const { getSupabaseAdmin } = require('./supabase');
const { isMembersOnlyTicket } = require('./ticket-visibility');
const { ticketRowToTier, fetchRegistrationCountsByTicket } = require('./supabase-events');
const { sendTemplatedEmail } = require('./send-template-email');
const {
  siteBase,
  hubAccountUrl,
  organiserPublicUrl,
  legalPolicyUrl,
  contactUrl,
  logoNavUrl,
  logoFooterUrl,
} = require('./hub-email-urls');
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
    .ilike('email', em)
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
    .ilike('email', em)
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

async function sendMemberRosterInviteEmail({ organiserRow, memberEmail, memberName, rosterRowId }) {
  const email = normalizeRosterEmail(memberEmail);
  if (!email || !organiserRow?.id) return { sent: false };

  const site = siteBase();
  const registerUrl =
    site +
    '/register?email=' +
    encodeURIComponent(email) +
    '&next=' +
    encodeURIComponent(organiserPublicUrl(organiserRow, site));

  try {
    await sendTemplatedEmail({
      slug: 'member_roster_invite',
      to: email,
      variables: {
        user_name: emailGreetingName(memberName, email),
        user_email: email,
        organiser_name: String(organiserRow.name || 'your networking group').trim(),
        organiser_url: organiserPublicUrl(organiserRow, site),
        register_url: registerUrl,
        hub_account_url: hubAccountUrl(site),
        site_url: site,
        logo_url: logoNavUrl(site),
        logo_footer_url: logoFooterUrl(site),
        privacy_url: legalPolicyUrl(site, 'privacy'),
        terms_url: legalPolicyUrl(site, 'terms'),
        contact_url: contactUrl(site),
      },
    });
  } catch (e) {
    if (e.code === 'emails_disabled' || /emails_disabled/i.test(String(e.message || ''))) {
      return { sent: false, skipped: 'emails_disabled' };
    }
    throw e;
  }

  if (rosterRowId) {
    const sb = getSupabaseAdmin();
    await sb
      .from('organiser_member_roster')
      .update({ invite_sent_at: new Date().toISOString() })
      .eq('id', rosterRowId);
  }

  return { sent: true };
}

async function claimRosterEntriesForAttendee(sb, { email, attendeeId }) {
  const em = normalizeRosterEmail(email);
  const attId = String(attendeeId || '').trim();
  if (!em || !attId) return { claimed: 0 };

  const pendingRes = await sb
    .from('organiser_member_roster')
    .select('id, organiser_id')
    .eq('status', ROSTER_STATUS_ACTIVE)
    .ilike('email', em)
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
    .ilike('email', em)
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
    .ilike('email', em);
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
    .select('id, claimed_at, invite_sent_at')
    .eq('organiser_id', orgId)
    .ilike('email', email)
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
    !attendeeId &&
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
      });
    }
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
  let ok = 0;
  let fail = 0;
  let invitesSent = 0;
  const errors = [];
  const sendInvite = options?.sendInvite === true;
  for (const row of rows || []) {
    try {
      const result = await upsertRosterMember(organiserId, row, { sendInvite });
      ok++;
      if (result.invite?.sent) invitesSent += 1;
    } catch (e) {
      fail++;
      if (errors.length < 20) {
        errors.push({ email: row.email, message: e.message });
      }
    }
  }
  return { total: (rows || []).length, ok, fail, invitesSent, errors };
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

    const { buildRegistrationRelationshipMap, relationshipForRegistration } = require('./organiser-attendee-relationship');
    const relMap = buildRegistrationRelationshipMap(regs || []);
    let newCount = 0;
    let returningCount = 0;
    (regs || []).forEach((row) => {
      const rel = relationshipForRegistration(row, relMap);
      if (rel.groupRelationship === 'new') newCount += 1;
      else if (rel.groupRelationship === 'returning') returningCount += 1;
    });
    reports.eventAttendance = {
      eventId: targetEventId,
      newCount,
      returningCount,
      totalRegistrations: (regs || []).length,
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
    .ilike('email', em)
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

module.exports = {
  ROSTER_STATUS_ACTIVE,
  ROSTER_STATUS_REMOVED,
  normalizeRosterEmail,
  rosterRowIsActive,
  getActiveRosterMembership,
  assertMembersOnlyBookingAllowed,
  claimRosterEntriesForAttendee,
  listRosterForOrganiser,
  upsertRosterMember,
  removeRosterMember,
  importRosterCsv,
  parseRosterCsv,
  loadMemberTicketsForEvent,
  buildRosterReports,
  listRosterGroupsForAttendee,
  sendMemberRosterInviteEmail,
  ensureOrganiserFavouritesForRoster,
};
