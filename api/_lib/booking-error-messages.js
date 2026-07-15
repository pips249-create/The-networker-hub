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
  stripe_not_configured: 'Card checkout is not configured on this server.',
  guest_visits_not_enabled: 'Guest visits are not available for this organiser.',
  guest_visits_exhausted:
    'You have used all complimentary visits with this organiser. Book a member ticket instead.',
  guest_visits_remaining:
    'Use your complimentary guest visit before booking a paid member ticket with this organiser.',
  guest_passes_disabled: 'Guest passes are not available for this event.',
  guest_visit_single_seat_only: 'Guest visits are limited to one seat per booking.',
  guest_visit_must_be_free: 'Guest visit bookings must be free.',
  alumni_not_eligible: 'This previous attendee ticket is invite-only. Use the link from your email.',
  not_invited: 'This previous attendee ticket is invite-only. Use the link from your email.',
  email_mismatch: 'Sign in with the email address that received the previous attendee invite.',
  not_enabled: 'Previous Attendees is not available for this event.',
  no_alumni_tier: 'The previous attendee ticket is not set up for this event yet.',
  alumni_single_seat_only: 'Previous attendee tickets are limited to one seat per booking.',
  missing_guest_names: 'Please enter a name for each guest.',
  members_only_not_eligible:
    'This ticket is for members of this group. Sign in with the email on their member list.',
  membership_expired:
    'Your membership has expired. Contact the organiser to renew before booking member tickets.',
  already_going:
    "You're already going to this event. View your ticket in My Hub.",
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
]);

function bookingErrorResponse(msg) {
  const code = String(msg || '').trim();
  const message = BOOKING_ERROR_MESSAGES[code];
  if (!message) return null;
  const status = ALUMNI_ERROR_CODES.has(code) ? 403 : 400;
  return { status, body: { ok: false, error: code, message } };
}

module.exports = { BOOKING_ERROR_MESSAGES, bookingErrorResponse };
