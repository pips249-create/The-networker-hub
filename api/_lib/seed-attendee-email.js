/**
 * Synthetic attendee addresses from local seed scripts (ranking demo reviews, etc.).
 * Never deliver outbound mail to these — they are not real inboxes.
 */
function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

const SEED_ATTENDEE_DOMAIN_SUFFIXES = ['@demo.hub.local', '@networkerhub.example'];

function isSeedAttendeeEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  if (normalized.startsWith('ranking-demo-')) return true;
  return SEED_ATTENDEE_DOMAIN_SUFFIXES.some(function (suffix) {
    return normalized.endsWith(suffix);
  });
}

module.exports = {
  normalizeEmail,
  isSeedAttendeeEmail,
};
