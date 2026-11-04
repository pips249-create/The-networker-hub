/**
 * Hard skips for organiser_new_registration (and similar) notify recipients.
 * Leaflet / stand QR check-ins must never email the Business Show contact
 * whose local-part is phoebe.strange.
 */

const BUSINESS_SHOW_LONDON_SLUG = 'the-business-show-london';
const BLOCKED_LOCAL_PARTS = new Set(['phoebe.strange']);

function emailLocalPart(raw) {
  const email = String(raw || '')
    .trim()
    .toLowerCase();
  if (!email || !email.includes('@')) return '';
  return email.split('@')[0] || '';
}

function normalizeEventSlug(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase();
}

/**
 * @param {{ email?: string, eventSlug?: string }} opts
 * @returns {boolean} true when the organiser notify must not be sent
 */
function shouldSkipOrganiserNewRegistrationNotify({ email, eventSlug } = {}) {
  const slug = normalizeEventSlug(eventSlug);
  if (slug !== BUSINESS_SHOW_LONDON_SLUG) return false;
  const local = emailLocalPart(email);
  return Boolean(local && BLOCKED_LOCAL_PARTS.has(local));
}

module.exports = {
  BUSINESS_SHOW_LONDON_SLUG,
  shouldSkipOrganiserNewRegistrationNotify,
  emailLocalPart,
};
