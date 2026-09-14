/**
 * Automated nurture pause defaults (no DB).
 * Run: node scripts/test-automated-email-sequences.js
 */
const path = require('path');

function loadFresh() {
  const modPath = path.join(__dirname, '../api/_lib/automated-email-sequences.js');
  delete require.cache[require.resolve(modPath)];
  return require(modPath);
}

function clearFlags() {
  delete process.env.AUTOMATED_EMAIL_SEQUENCES_FORCE_ON;
  delete process.env.AUTOMATED_EMAIL_SEQUENCES_FORCE_OFF;
  delete process.env.AUTOMATED_EMAIL_SEQUENCES_RESUME_AT;
  delete process.env.HUBERT_EVENT_CONCIERGE_EMAILS_ENABLED;
  delete process.env.HUBERT_EVENT_CONCIERGE_EMAILS_FORCE_OFF;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
  console.log('ok:', msg);
}

clearFlags();
let m = loadFresh();
assert(m.areAutomatedEmailSequencesEnabled() === false, 'nurture paused by default');
assert(m.areHubertEventConciergeEmailsEnabled() === false, 'Hubert digest paused by default');

process.env.AUTOMATED_EMAIL_SEQUENCES_FORCE_ON = 'true';
m = loadFresh();
assert(m.areAutomatedEmailSequencesEnabled() === true, 'FORCE_ON resumes nurture');

process.env.AUTOMATED_EMAIL_SEQUENCES_FORCE_OFF = 'true';
m = loadFresh();
assert(m.areAutomatedEmailSequencesEnabled() === false, 'FORCE_OFF wins over FORCE_ON');

clearFlags();
process.env.AUTOMATED_EMAIL_SEQUENCES_RESUME_AT = '2020-01-01T00:00:00Z';
m = loadFresh();
assert(m.areAutomatedEmailSequencesEnabled() === true, 'explicit past RESUME_AT enables');

clearFlags();
process.env.AUTOMATED_EMAIL_SEQUENCES_RESUME_AT = '2099-01-01T00:00:00Z';
m = loadFresh();
assert(m.areAutomatedEmailSequencesEnabled() === false, 'future RESUME_AT stays paused');

clearFlags();
process.env.HUBERT_EVENT_CONCIERGE_EMAILS_ENABLED = 'true';
m = loadFresh();
assert(m.areHubertEventConciergeEmailsEnabled() === true, 'Hubert enables with opt-in flag');

process.env.HUBERT_EVENT_CONCIERGE_EMAILS_FORCE_OFF = 'true';
m = loadFresh();
assert(m.areHubertEventConciergeEmailsEnabled() === false, 'Hubert FORCE_OFF wins');

assert(m.isAutomatedSequenceCronRoute('engagement-emails') === true, 'engagement cron gated');
assert(m.isAutomatedSequenceCronRoute('booking-reminders') === false, 'booking reminders stay ungated');

console.log('All automated email sequence checks passed');
