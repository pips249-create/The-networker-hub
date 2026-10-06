/**
 * Attendee emails about a specific event (booking, reminder, join link)
 * should Reply-To the organiser — not the Hub inbox.
 */
const { resolveOrganiserNotificationEmail } = require('./organiser-notification-email');
const { supportEmail } = require('./hub-email-urls');

/** Slugs where attendee "Reply" should reach the event organiser. */
const ATTENDEE_EVENT_REPLY_TO_ORGANISER_SLUGS = new Set([
  'booking_confirmation',
  'booking_reminder',
  'online_join_reminder',
  'meeting_link_added',
  'application_received',
  'application_approved',
  'application_denied',
  'booking_cancelled',
  'event_cancelled',
  'event_updated',
  'refund_processed',
]);

function isAttendeeEventReplyToOrganiserSlug(slug) {
  return ATTENDEE_EVENT_REPLY_TO_ORGANISER_SLUGS.has(String(slug || '').trim());
}

/**
 * @returns {Promise<{ replyTo: string, organiserName: string, organiserEmail: string }>}
 */
async function resolveAttendeeEventReplyTo(sb, organiserId) {
  const contact = await resolveOrganiserNotificationEmail(sb, organiserId);
  const organiserEmail = String(contact.email || '')
    .trim()
    .toLowerCase();
  const organiserName = String(contact.name || '').trim();
  return {
    replyTo: organiserEmail || supportEmail(),
    organiserName,
    organiserEmail,
  };
}

module.exports = {
  ATTENDEE_EVENT_REPLY_TO_ORGANISER_SLUGS,
  isAttendeeEventReplyToOrganiserSlug,
  resolveAttendeeEventReplyTo,
};
