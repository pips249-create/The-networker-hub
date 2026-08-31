/** User-facing messages for registration / checkout validation errors. */
const BOOKING_ERROR_MESSAGES = {
  missing_checkout_session: 'Checkout session missing. Please try booking again.',
  payment_not_completed: 'Payment was not completed. Please try again.',
  event_mismatch: 'This checkout does not match the event. Please start again.',
  invalid_checkout_type: 'Invalid checkout type. Please start again.',
  ticket_requires_payment: 'This ticket requires payment. Please use checkout.',
  ticket_not_found: 'That ticket type is no longer available.',
  ticket_event_mismatch: 'That ticket does not belong to this event.',
  event_not_found: 'This event could not be found.',
  event_not_published: 'This event is not available for booking.',
  missing_organiser: 'This event is not available for booking.',
  stripe_not_configured: 'Card checkout is not configured on this server.',
  guest_visits_not_enabled: 'Free visits are not available for this organiser.',
  guest_visits_exhausted:
    'You have used all free visits with this organiser. Join their membership to keep attending, or book a member ticket if you are already on their list.',
  guest_visits_remaining:
    'Use your free visit before booking a paid member ticket with this organiser.',
  guest_passes_disabled: 'Free visits are not available for this event.',
  guest_visit_single_seat_only: 'Free visits are limited to one seat per booking.',
  guest_visit_must_be_free: 'Free visit bookings must be free.',
  alumni_not_eligible: 'This previous attendee ticket is invite-only. Use the link from your email.',
  not_invited: 'This previous attendee ticket is invite-only. Use the link from your email.',
  email_mismatch: 'Sign in with the email address that received the previous attendee invite.',
  not_enabled: 'Previous Attendees is not available for this event.',
  no_alumni_tier: 'The previous attendee ticket is not set up for this event yet.',
  alumni_single_seat_only: 'Previous attendee tickets are limited to one seat per booking.',
  missing_guest_names: 'Please enter a name for each guest.',
  members_only_not_eligible:
    'This ticket is for members of this group. Sign in with the email on their membership.',
  membership_expired:
    'Your membership has expired. Contact the organiser to renew before booking member tickets.',
  already_going:
    "You're already going to this event. View your ticket in My account.",
  organiser_attendance_blocked:
    "You're not able to book this organiser's events. Contact them if you think this is a mistake.",
  ticket_sold_out: 'Sorry — that ticket tier is sold out.',
  event_sold_out: 'Sorry — this event is fully booked.',
  applications_full: 'Sorry — all places for this event are taken.',
  ticket_sales_platform_closed:
    'Ticket buying opens at 9am on 1 September 2026. You can browse events now — ticket interest alerts start then too.',
};

const ALUMNI_ERROR_CODES = new Set([
  'alumni_not_eligible',
  'not_invited',
  'email_mismatch',
  'not_enabled',
  'no_alumni_tier',
  'alumni_single_seat_only',
  'members_only_not_eligible',
  'membership_expired',
  'organiser_attendance_blocked',
  'ticket_sales_platform_closed',
]);

function bookingErrorResponse(msg) {
  const code = String(msg || '').trim();
  const message = BOOKING_ERROR_MESSAGES[code];
  if (!message) return null;
  const status = ALUMNI_ERROR_CODES.has(code) ? 403 : 400;
  return { status, body: { ok: false, error: code, message } };
}

module.exports = { BOOKING_ERROR_MESSAGES, bookingErrorResponse };
