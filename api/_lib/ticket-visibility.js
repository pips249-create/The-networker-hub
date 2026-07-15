/**
 * Ticket visibility helpers — public listing vs members_only (roster).
 */

const VISIBILITY_PUBLIC = 'public';
const VISIBILITY_MEMBERS_ONLY = 'members_only';

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

module.exports = {
  VISIBILITY_PUBLIC,
  VISIBILITY_MEMBERS_ONLY,
  normalizeTicketVisibility,
  isMembersOnlyTicket,
};
