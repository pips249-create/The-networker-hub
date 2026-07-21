/**
 * Guest visit programme — complimentary trial visits per attendee per organiser.
 * Platform cap: 3 visits (organisers choose 0–3).
 */
const PLATFORM_MAX_COMPLIMENTARY_VISITS = 3;
const GUEST_VISIT_TICKET_TYPE = 'Guest-visit';
const GUEST_VISIT_TIER_NAME = 'Guest visit';

function clampComplimentaryVisitsAllowed(raw) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(PLATFORM_MAX_COMPLIMENTARY_VISITS, Math.floor(n));
}

function isGuestVisitTicket(ticket) {
  if (!ticket) return false;
  const type = String(ticket.ticket_type || ticket.ticketType || '').trim();
  if (type === GUEST_VISIT_TICKET_TYPE) return true;
  return /^guest\s*visit$/i.test(String(ticket.name || '').trim());
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

async function countUsedGuestVisits(sb, { organiserId, attendeeId, email }) {
  const orgId = String(organiserId || '').trim();
  if (!orgId) return 0;

  const resolvedAttendeeId = await resolveAttendeeId(sb, { attendeeId, email });
  if (!resolvedAttendeeId) return 0;

  const { data, error } = await sb
    .from('registrations')
    .select('id, quantity')
    .eq('organiser_id', orgId)
    .eq('attendee_id', resolvedAttendeeId)
    .eq('registration_kind', 'guest_visit')
    .neq('payment_status', 'Refunded')
    .neq('application_status', 'Denied')
    .is('cancelled_at', null);
  if (error) throw new Error(error.message);

  return (data || []).reduce((sum, row) => sum + Math.max(1, Number(row.quantity) || 1), 0);
}

async function getGuestVisitEligibility(sb, { organiserId, attendeeId, userId, email, allowed }) {
  const allowedVisits = clampComplimentaryVisitsAllowed(allowed);
  const orgId = String(organiserId || '').trim();
  const normalizedEmail = String(email || '')
    .trim()
    .toLowerCase();
  const sessionUserId = String(userId || attendeeId || '').trim() || null;

  if (orgId && (normalizedEmail || sessionUserId)) {
    const { getActiveRosterMembership } = require('./organiser-member-roster');
    const membership = await getActiveRosterMembership(sb, {
      organiserId: orgId,
      email: normalizedEmail,
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
        platformMax: PLATFORM_MAX_COMPLIMENTARY_VISITS,
      };
    }
  }

  const used = await countUsedGuestVisits(sb, { organiserId, attendeeId, email });
  const remaining = Math.max(0, allowedVisits - used);
  return {
    allowed: allowedVisits,
    used,
    remaining,
    eligible: remaining > 0,
    platformMax: PLATFORM_MAX_COMPLIMENTARY_VISITS,
  };
}

async function loadOrganiserGuestVisitAllowance(sb, organiserId) {
  const { data, error } = await sb
    .from('organisers')
    .select('id, complimentary_visits_allowed')
    .eq('id', organiserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return 0;
  return clampComplimentaryVisitsAllowed(data.complimentary_visits_allowed);
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
  const allowed = await loadOrganiserGuestVisitAllowance(sb, organiserId);
  if (allowed < 1) {
    const err = new Error('guest_visits_not_enabled');
    err.status = 400;
    throw err;
  }
  const eligibility = await getGuestVisitEligibility(sb, {
    organiserId,
    attendeeId,
    userId: attendeeId,
    email,
    allowed,
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
  if (String(attendanceMode || '').trim() !== 'guest_programme') return null;
  if (guestPassesDisabled) return null;
  const allowed = await loadOrganiserGuestVisitAllowance(sb, organiserId);
  if (allowed < 1) return null;
  const eligibility = await getGuestVisitEligibility(sb, {
    organiserId,
    attendeeId,
    userId: attendeeId,
    email,
    allowed,
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
  clampComplimentaryVisitsAllowed,
  isGuestVisitTicket,
  guestVisitTierPayload,
  countUsedGuestVisits,
  getGuestVisitEligibility,
  loadOrganiserGuestVisitAllowance,
  assertGuestVisitBookingAllowed,
  assertPaidMemberBookingAllowed,
};
