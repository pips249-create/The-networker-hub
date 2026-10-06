/**
 * Blind-copy organisers on attendee event emails.
 * Attendees never see the organiser address (BCC, not Reply-To / CC).
 */
const { resolveOrganiserNotificationEmail } = require('./organiser-notification-email');
const { isRecipientAllowed, normalizeEmail } = require('./email-allowlist');
const { supportEmail } = require('./hub-email-urls');

function normalizeBccList(raw, attendeeEmail) {
  const attendee = normalizeEmail(attendeeEmail);
  const hub = normalizeEmail(supportEmail());
  const seen = new Set();
  const out = [];
  const list = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
  for (const item of list) {
    const email = normalizeEmail(item);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    if (attendee && email === attendee) continue;
    if (hub && email === hub) continue;
    if (seen.has(email)) continue;
    if (!isRecipientAllowed(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

/**
 * @returns {Promise<string[]>} zero or one organiser email for Resend `bcc`
 */
async function resolveOrganiserBcc(sb, organiserId, attendeeEmail) {
  const contact = await resolveOrganiserNotificationEmail(sb, organiserId);
  return normalizeBccList(contact.email, attendeeEmail);
}

module.exports = {
  normalizeBccList,
  resolveOrganiserBcc,
};
