/**
 * Guest visit programme — complimentary trial visits per attendee.
 * Platform cap: 3 visits (organisers choose 0–3).
 * Scope: per organiser page (default) or across all sibling pages.
 */
const PLATFORM_MAX_COMPLIMENTARY_VISITS = 3;
const GUEST_VISIT_TICKET_TYPE = 'Guest-visit';
const GUEST_VISIT_TIER_NAME = 'Guest visit';
const GUEST_VISIT_SCOPE_PER_GROUP = 'per_group';
const GUEST_VISIT_SCOPE_ACROSS_GROUPS = 'across_groups';

function clampComplimentaryVisitsAllowed(raw) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(PLATFORM_MAX_COMPLIMENTARY_VISITS, Math.floor(n));
}

function normalizeComplimentaryVisitsScope(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  if (s === GUEST_VISIT_SCOPE_ACROSS_GROUPS || s === 'across' || s === 'shared') {
    return GUEST_VISIT_SCOPE_ACROSS_GROUPS;
  }
  return GUEST_VISIT_SCOPE_PER_GROUP;
}

function isGuestVisitTicket(ticket) {
  if (!ticket) return false;
  const type = String(ticket.ticket_type || ticket.ticketType || '').trim();
  if (type === GUEST_VISIT_TICKET_TYPE) return true;
  return /^guest\s*visit$/i.test(String(ticket.name || '').trim());
}

function isMembersOnlyTicket(ticket) {
  return String(ticket?.visibility || '').toLowerCase() === 'members_only';
}

function isAlumniTicket(ticket) {
  if (!ticket) return false;
  const type = String(ticket.ticket_type || ticket.ticketType || '').trim();
  if (type === 'Alumni') return true;
  return Boolean(ticket.isAlumni) || /^alumni/i.test(String(ticket.name || '').trim());
}

/** Public tickets people can buy without being on the member list. */
function isPublicSaleTicket(ticket) {
  if (!ticket) return false;
  if (isGuestVisitTicket(ticket) || isAlumniTicket(ticket) || isMembersOnlyTicket(ticket)) {
    return false;
  }
  const type = String(ticket.ticket_type || ticket.ticketType || '').trim().toLowerCase();
  if (type === 'guest-visit' || type === 'alumni') return false;
  return true;
}

function ticketPriceAmount(ticket) {
  const n = Number(ticket && ticket.price);
  return Number.isFinite(n) ? n : 0;
}

/**
 * “First meeting”, “guest visit”, “taster” etc — organisers often create these
 * as a £0 ticket instead of the complimentary visit programme.
 */
function looksLikeComplimentaryVisitTicketName(name) {
  const n = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '');
  if (!n) return false;
  if (/^guest\s*visit$/i.test(n)) return true;
  return (
    /\b(first|1st|trial|taster|intro|introductory|complimentary|visitor|guest)\b/.test(n) &&
    /\b(visit|meeting|ticket|session|breakfast|lunch|event)\b/.test(n)
  );
}

function publicTicketsMixFreeAndPaid(tickets) {
  const publicTiers = (Array.isArray(tickets) ? tickets : []).filter(isPublicSaleTicket);
  const hasFree = publicTiers.some((t) => ticketPriceAmount(t) <= 0);
  const hasPaid = publicTiers.some((t) => ticketPriceAmount(t) > 0);
  return hasFree && hasPaid;
}

/**
 * Free + paid public tickets are allowed (e.g. online free, in-person paid).
 * A £0 ticket named like a first visit (“First Meeting”) next to a paid ticket
 * is the pattern that must use complimentary visits — that ticket can be
 * booked on every remaining date with no visit cap.
 */
function publicFreeTicketIsFirstVisitStandIn(tickets) {
  const publicTiers = (Array.isArray(tickets) ? tickets : []).filter(isPublicSaleTicket);
  const hasPaid = publicTiers.some((t) => ticketPriceAmount(t) > 0);
  if (!hasPaid) return false;
  return publicTiers.some(
    (t) => ticketPriceAmount(t) <= 0 && looksLikeComplimentaryVisitTicketName(t && t.name)
  );
}

function guestVisitTierPayload() {
  return {
    name: GUEST_VISIT_TIER_NAME,
    price: 0,
    description: 'Complimentary trial visit for new attendees.',
    status: 'Available',
    quantityAvailable: null,
    ticketType: GUEST_VISIT_TICKET_TYPE,
    displayOrder: -1,
  };
}

async function resolveAttendeeId(sb, { attendeeId, email }) {
  const id = String(attendeeId || '').trim();
  if (id) {
    // Callers sometimes pass attendees.id; create-checkout / eligibility pass session.sub
    // (supabase auth user id). Resolve both before falling back to email.
    const byId = await sb.from('attendees').select('id').eq('id', id).maybeSingle();
    if (byId.error) throw new Error(byId.error.message);
    if (byId.data?.id) return byId.data.id;

    const byUser = await sb
      .from('attendees')
      .select('id')
      .eq('supabase_user_id', id)
      .maybeSingle();
    if (byUser.error) throw new Error(byUser.error.message);
    if (byUser.data?.id) return byUser.data.id;
  }
  const normalized = String(email || '')
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  const { data, error } = await sb
    .from('attendees')
    .select('id')
    .eq('email', normalized)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id || null;
}

/** All organiser page IDs in the same account / owner-email family. */
async function resolveSiblingOrganiserIds(sb, organiserId) {
  const orgId = String(organiserId || '').trim();
  if (!orgId) return [];

  const { data: org, error } = await sb
    .from('organisers')
    .select('id, organiser_account_id, email, contact_email')
    .eq('id', orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!org?.id) return [orgId];

  const ids = new Set([org.id]);

  if (org.organiser_account_id) {
    const { data, error: accErr } = await sb
      .from('organisers')
      .select('id')
      .eq('organiser_account_id', org.organiser_account_id);
    if (accErr) throw new Error(accErr.message);
    (data || []).forEach((row) => {
      if (row?.id) ids.add(row.id);
    });
  }

  const emails = [
    ...new Set(
      [org.email, org.contact_email]
        .map((e) =>
          String(e || '')
            .trim()
            .toLowerCase()
        )
        .filter(Boolean)
    ),
  ];
  for (const em of emails) {
    const { data, error: emErr } = await sb
      .from('organisers')
      .select('id')
      .or(`email.eq.${em},contact_email.eq.${em}`);
    if (emErr) throw new Error(emErr.message);
    (data || []).forEach((row) => {
      if (row?.id) ids.add(row.id);
    });
  }

  return [...ids];
}

async function loadOrganiserGuestVisitSettings(sb, organiserId) {
  const orgId = String(organiserId || '').trim();
  if (!orgId) {
    return {
      allowed: 0,
      scope: GUEST_VISIT_SCOPE_PER_GROUP,
      organiserIds: [],
    };
  }

  // Prefer explicit columns; fall back if complimentary_visits_scope migration is not applied yet.
  let data = null;
  let error = null;
  ({ data, error } = await sb
    .from('organisers')
    .select('id, complimentary_visits_allowed, complimentary_visits_scope')
    .eq('id', orgId)
    .maybeSingle());
  if (error && /complimentary_visits_scope/i.test(String(error.message || ''))) {
    ({ data, error } = await sb
      .from('organisers')
      .select('id, complimentary_visits_allowed')
      .eq('id', orgId)
      .maybeSingle());
  }
  if (error) throw new Error(error.message);
  if (!data) {
    return {
      allowed: 0,
      scope: GUEST_VISIT_SCOPE_PER_GROUP,
      organiserIds: [orgId],
    };
  }

  const allowed = clampComplimentaryVisitsAllowed(data.complimentary_visits_allowed);
  const scope = normalizeComplimentaryVisitsScope(data.complimentary_visits_scope);
  const organiserIds =
    scope === GUEST_VISIT_SCOPE_ACROSS_GROUPS
      ? await resolveSiblingOrganiserIds(sb, orgId)
      : [orgId];

  return { allowed, scope, organiserIds };
}

async function countUsedGuestVisits(sb, { organiserId, organiserIds, attendeeId, email }) {
  const ids = (Array.isArray(organiserIds) ? organiserIds : [])
    .map((id) => String(id || '').trim())
    .filter(Boolean);
  if (!ids.length) {
    const orgId = String(organiserId || '').trim();
    if (orgId) ids.push(orgId);
  }
  if (!ids.length) return 0;

  const resolvedAttendeeId = await resolveAttendeeId(sb, { attendeeId, email });
  if (!resolvedAttendeeId) return 0;

  let query = sb
    .from('registrations')
    .select('id, quantity')
    .eq('attendee_id', resolvedAttendeeId)
    .eq('registration_kind', 'guest_visit')
    .neq('payment_status', 'Refunded')
    .neq('application_status', 'Denied')
    .is('cancelled_at', null);

  if (ids.length === 1) query = query.eq('organiser_id', ids[0]);
  else query = query.in('organiser_id', ids);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).reduce((sum, row) => sum + Math.max(1, Number(row.quantity) || 1), 0);
}

async function getGuestVisitEligibility(sb, { organiserId, attendeeId, userId, email, allowed, scope }) {
  const orgId = String(organiserId || '').trim();
  const settings =
    allowed != null && scope
      ? {
          allowed: clampComplimentaryVisitsAllowed(allowed),
          scope: normalizeComplimentaryVisitsScope(scope),
          organiserIds:
            normalizeComplimentaryVisitsScope(scope) === GUEST_VISIT_SCOPE_ACROSS_GROUPS
              ? await resolveSiblingOrganiserIds(sb, orgId)
              : orgId
                ? [orgId]
                : [],
        }
      : await loadOrganiserGuestVisitSettings(sb, orgId);

  const allowedVisits =
    allowed != null ? clampComplimentaryVisitsAllowed(allowed) : settings.allowed;
  const visitScope = scope ? normalizeComplimentaryVisitsScope(scope) : settings.scope;
  const normalisedEmail = String(email || '')
    .trim()
    .toLowerCase();
  const sessionUserId = String(userId || attendeeId || '').trim() || null;

  if (orgId && (normalisedEmail || sessionUserId)) {
    const { getActiveRosterMembership } = require('./organiser-member-roster');
    const membership = await getActiveRosterMembership(sb, {
      organiserId: orgId,
      email: normalisedEmail,
      attendeeId: sessionUserId,
      userId: sessionUserId,
    });
    if (membership.active) {
      return {
        allowed: allowedVisits,
        used: allowedVisits,
        remaining: 0,
        eligible: false,
        isRosterMember: true,
        scope: visitScope,
        platformMax: PLATFORM_MAX_COMPLIMENTARY_VISITS,
      };
    }
  }

  const used = await countUsedGuestVisits(sb, {
    organiserId: orgId,
    organiserIds: settings.organiserIds,
    attendeeId,
    email,
  });
  const remaining = Math.max(0, allowedVisits - used);
  return {
    allowed: allowedVisits,
    used,
    remaining,
    eligible: remaining > 0,
    scope: visitScope,
    platformMax: PLATFORM_MAX_COMPLIMENTARY_VISITS,
  };
}

async function loadOrganiserGuestVisitAllowance(sb, organiserId) {
  const settings = await loadOrganiserGuestVisitSettings(sb, organiserId);
  return settings.allowed;
}

/**
 * Keep sibling pages in sync when an organiser chooses a shared visit pool,
 * or when they change the shared allowance / switch back to per-group.
 * No-ops gracefully if complimentary_visits_scope has not been migrated yet.
 */
async function syncSiblingGuestVisitSettings(sb, organiserId, { allowed, scope }) {
  const orgId = String(organiserId || '').trim();
  if (!orgId) return;
  const normalizedScope = normalizeComplimentaryVisitsScope(scope);
  const siblingIds = await resolveSiblingOrganiserIds(sb, orgId);
  const otherIds = siblingIds.filter((id) => id !== orgId);
  if (!otherIds.length) return;

  const patch = { complimentary_visits_scope: normalizedScope };
  if (allowed != null) {
    patch.complimentary_visits_allowed = clampComplimentaryVisitsAllowed(allowed);
  }

  let { error } = await sb.from('organisers').update(patch).in('id', otherIds);
  if (error && /complimentary_visits_scope/i.test(String(error.message || ''))) {
    if (allowed == null) return;
    ({ error } = await sb
      .from('organisers')
      .update({ complimentary_visits_allowed: clampComplimentaryVisitsAllowed(allowed) })
      .in('id', otherIds));
  }
  if (error) throw new Error(error.message);
}

async function assertGuestVisitBookingAllowed(
  sb,
  { organiserId, attendeeId, email, guestPassesDisabled }
) {
  if (guestPassesDisabled) {
    const err = new Error('guest_passes_disabled');
    err.status = 400;
    throw err;
  }
  const settings = await loadOrganiserGuestVisitSettings(sb, organiserId);
  if (settings.allowed < 1) {
    const err = new Error('guest_visits_not_enabled');
    err.status = 400;
    throw err;
  }
  const eligibility = await getGuestVisitEligibility(sb, {
    organiserId,
    attendeeId,
    userId: attendeeId,
    email,
    allowed: settings.allowed,
    scope: settings.scope,
  });
  if (eligibility.isRosterMember) {
    const err = new Error('guest_visits_roster_member');
    err.status = 400;
    throw err;
  }
  if (!eligibility.eligible) {
    const err = new Error('guest_visits_exhausted');
    err.status = 400;
    err.eligibility = eligibility;
    throw err;
  }
  return eligibility;
}

async function assertPaidMemberBookingAllowed(
  sb,
  { organiserId, attendeeId, email, attendanceMode, guestPassesDisabled }
) {
  if (String(attendanceMode || '').trim() !== 'guest_programme' &&
      String(attendanceMode || '').trim() !== 'membership_meeting') {
    return null;
  }
  if (guestPassesDisabled) return null;
  const settings = await loadOrganiserGuestVisitSettings(sb, organiserId);
  if (settings.allowed < 1) return null;
  const eligibility = await getGuestVisitEligibility(sb, {
    organiserId,
    attendeeId,
    userId: attendeeId,
    email,
    allowed: settings.allowed,
    scope: settings.scope,
  });
  if (eligibility.remaining > 0) {
    const err = new Error('guest_visits_remaining');
    err.status = 400;
    err.eligibility = eligibility;
    throw err;
  }
  return eligibility;
}

module.exports = {
  PLATFORM_MAX_COMPLIMENTARY_VISITS,
  GUEST_VISIT_TICKET_TYPE,
  GUEST_VISIT_TIER_NAME,
  GUEST_VISIT_SCOPE_PER_GROUP,
  GUEST_VISIT_SCOPE_ACROSS_GROUPS,
  clampComplimentaryVisitsAllowed,
  normalizeComplimentaryVisitsScope,
  isGuestVisitTicket,
  isMembersOnlyTicket,
  isAlumniTicket,
  isPublicSaleTicket,
  looksLikeComplimentaryVisitTicketName,
  publicTicketsMixFreeAndPaid,
  publicFreeTicketIsFirstVisitStandIn,
  guestVisitTierPayload,
  resolveSiblingOrganiserIds,
  loadOrganiserGuestVisitSettings,
  countUsedGuestVisits,
  getGuestVisitEligibility,
  loadOrganiserGuestVisitAllowance,
  syncSiblingGuestVisitSettings,
  assertGuestVisitBookingAllowed,
  assertPaidMemberBookingAllowed,
};
