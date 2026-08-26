/**
 * Category Exclusivity (application-based) booking guards.
 * Apply → organiser approve → pay via linked registration only.
 *
 * Guest-visit and Alumni tickets stay direct-book even on CE events
 * (trial visits / previous-attendee invites do not need an application).
 */

function isCategoryExclusivityEvent(event) {
  const mode = String(event?.attendance_mode || event?.attendanceMode || '')
    .trim()
    .toLowerCase();
  return mode === 'category_exclusivity' || mode === 'osop';
}

function isApplicationBasedTicket(ticket) {
  if (!ticket) return false;
  const type = String(ticket.ticket_type || ticket.ticketType || '')
    .trim()
    .toLowerCase();
  return (
    type === 'application-based' ||
    type === 'application_based' ||
    type.includes('application')
  );
}

/** Direct-book ticket kinds that never require a CE application. */
function isApplicationExemptTicket(ticket) {
  if (!ticket) return false;
  const type = String(ticket.ticket_type || ticket.ticketType || '')
    .trim()
    .toLowerCase();
  if (type === 'guest-visit' || type === 'alumni') return true;
  if (Boolean(ticket.isAlumni) || /^alumni/i.test(String(ticket.name || '').trim())) return true;
  if (/^guest\s*visit$/i.test(String(ticket.name || '').trim())) return true;
  return false;
}

/** True when checkout/registration must go through an approved application row. */
function requiresApprovedApplication(event, ticket) {
  if (isApplicationExemptTicket(ticket)) return false;
  return isCategoryExclusivityEvent(event) || isApplicationBasedTicket(ticket);
}

/**
 * Active Membership list members may book CE tickets without a prior application.
 * Callers must still verify roster membership server-side before bypassing.
 */
function allowsMemberDirectBook(event, ticket) {
  return isCategoryExclusivityEvent(event) || isApplicationBasedTicket(ticket);
}

module.exports = {
  isCategoryExclusivityEvent,
  isApplicationBasedTicket,
  isApplicationExemptTicket,
  requiresApprovedApplication,
  allowsMemberDirectBook,
};
