/**
 * Member roster — per organiser page access for members_only tickets.
 */
const { getSupabaseAdmin } = require('./supabase');
const { isMembersOnlyTicket } = require('./ticket-access-codes');
const { ticketRowToTier, fetchRegistrationCountsByTicket } = require('./supabase-events');

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

async function claimRosterEntriesForAttendee(sb, { email, attendeeId }) {
  const em = normalizeRosterEmail(email);
  const attId = String(attendeeId || '').trim();
  if (!em || !attId) return { claimed: 0 };

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
    .select('id');
  if (error) throw new Error(error.message);
  return { claimed: (data || []).length };
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    membershipActive: rosterRowIsActive(row),
    daysUntilExpiry: days,
    expiringSoon: days != null && days >= 0 && days <= 14,
  };
}

async function upsertRosterMember(organiserId, payload) {
  const sb = getSupabaseAdmin();
  const orgId = String(organiserId || '').trim();
  const email = normalizeRosterEmail(payload.email);
  const name = String(payload.name || '').trim() || null;
  const expiresAt = parseExpiresAt(payload.expiresAt ?? payload.expires_at);
  const status = String(payload.status || ROSTER_STATUS_ACTIVE).trim();

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
    .select('id, claimed_at')
    .eq('organiser_id', orgId)
    .ilike('email', email)
    .maybeSingle();

  if (existing?.id) {
    if (existing.claimed_at) row.claimed_at = existing.claimed_at;
    const { data, error } = await sb
      .from('organiser_member_roster')
      .update(row)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return rosterRowToClient(data);
  }

  row.invited_at = now;
  const { data, error } = await sb
    .from('organiser_member_roster')
    .insert(row)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return rosterRowToClient(data);
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

async function importRosterCsv(organiserId, rows) {
  let ok = 0;
  let fail = 0;
  const errors = [];
  for (const row of rows || []) {
    try {
      await upsertRosterMember(organiserId, row);
      ok++;
    } catch (e) {
      fail++;
      if (errors.length < 20) {
        errors.push({ email: row.email, message: e.message });
      }
    }
  }
  return { total: (rows || []).length, ok, fail, errors };
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
};
