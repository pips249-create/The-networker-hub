/**
 * Detect E2E / seed fixtures so Command Centre metrics ignore them.
 * Keep patterns narrow — only match deliberate test markers, not ordinary titles.
 */

function isTestFixtureText(text) {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return false;
  return (
    /\be2e\b/.test(t) ||
    /e2e[-_]/.test(t) ||
    /review test attendee/.test(t) ||
    /^\[test\]/.test(t)
  );
}

function isTestFixtureEmail(email) {
  const e = String(email || '').toLowerCase().trim();
  if (!e) return false;
  if (/^e2e[-._+]/.test(e)) return true;
  // Seed scripts use example.com with an e2e local-part.
  if (/@example\.com$/.test(e) && /(?:^|[+._-])e2e(?:[+._-]|$)/.test(e.split('@')[0])) {
    return true;
  }
  return false;
}

function isTestRegistration(reg) {
  if (!reg || typeof reg !== 'object') return false;
  const who = reg.attendees?.name || '';
  const email = reg.attendees?.email || '';
  const eventTitle = reg.events?.title || reg.event_title || '';
  const orgName = reg.organisers?.name || '';
  return (
    isTestFixtureText(who) ||
    isTestFixtureEmail(email) ||
    isTestFixtureText(eventTitle) ||
    isTestFixtureText(orgName)
  );
}

module.exports = {
  isTestFixtureText,
  isTestFixtureEmail,
  isTestRegistration,
};
