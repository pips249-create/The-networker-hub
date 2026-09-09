/**
 * Ticket visibility helpers — public listing vs members_only (member list).
 */

const VISIBILITY_PUBLIC = 'public';
const VISIBILITY_MEMBERS_ONLY = 'members_only';

/** Attendance modes that always offer a non-member booking path. */
const OPEN_GUEST_ATTENDANCE_MODES = new Set([
  'category_exclusivity',
  'osop',
  'guest_programme',
  'membership_meeting',
]);

function normalizeTicketVisibility(raw) {
  const v = String(raw || VISIBILITY_PUBLIC).toLowerCase();
  if (v === VISIBILITY_MEMBERS_ONLY) return VISIBILITY_MEMBERS_ONLY;
  return VISIBILITY_PUBLIC;
}

function isMembersOnlyTicket(ticket) {
  if (!ticket) return false;
  return (
    normalizeTicketVisibility(ticket.visibility || ticket.ticketVisibility) ===
    VISIBILITY_MEMBERS_ONLY
  );
}

/**
 * True only for closed member-list events (no public ticket, no guest-visit path).
 * membership_meeting / guest_programme keep members_only tiers for after visits,
 * but guests can still book complimentary visits — never label those "Members only".
 */
function isClosedMembersOnlyEvent({
  attendanceMode,
  membersOnlyTierCount = 0,
  publicTiersCount = 0,
  hasGuestVisitTier = false,
} = {}) {
  const mode = String(attendanceMode || '')
    .trim()
    .toLowerCase();
  if (OPEN_GUEST_ATTENDANCE_MODES.has(mode)) return false;
  if (hasGuestVisitTier) return false;
  return Number(membersOnlyTierCount) > 0 && Number(publicTiersCount) === 0;
}

module.exports = {
  VISIBILITY_PUBLIC,
  VISIBILITY_MEMBERS_ONLY,
  OPEN_GUEST_ATTENDANCE_MODES,
  normalizeTicketVisibility,
  isMembersOnlyTicket,
  isClosedMembersOnlyEvent,
};
