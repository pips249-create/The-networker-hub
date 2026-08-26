/**
 * Soft-launch pause for automated / nurture email sequences.
 * Resumes 5 September 2026 (Europe/London) unless overridden.
 *
 * Does NOT block transactional mail triggered by user actions
 * (booking confirmations, password reset, claim invites, etc.).
 *
 * Override:
 *   AUTOMATED_EMAIL_SEQUENCES_FORCE_ON=true
 *   AUTOMATED_EMAIL_SEQUENCES_FORCE_OFF=true
 *   AUTOMATED_EMAIL_SEQUENCES_RESUME_AT=2026-09-05T00:00:00+01:00
 */

const DEFAULT_RESUME_AT = '2026-09-05T00:00:00+01:00';

function parseEnvFlag(name) {
  const raw = String(process.env[name] || '')
    .trim()
    .toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function automatedEmailSequencesResumeAt() {
  const raw = String(process.env.AUTOMATED_EMAIL_SEQUENCES_RESUME_AT || '')
    .trim();
  if (raw) {
    const ms = Date.parse(raw);
    if (Number.isFinite(ms)) return new Date(ms).toISOString();
  }
  return DEFAULT_RESUME_AT;
}

function automatedEmailSequencesResumeAtMs() {
  return Date.parse(automatedEmailSequencesResumeAt());
}

function areAutomatedEmailSequencesEnabled(nowMs) {
  if (parseEnvFlag('AUTOMATED_EMAIL_SEQUENCES_FORCE_OFF')) return false;
  if (parseEnvFlag('AUTOMATED_EMAIL_SEQUENCES_FORCE_ON')) return true;
  const now = nowMs == null ? Date.now() : Number(nowMs);
  return now >= automatedEmailSequencesResumeAtMs();
}

/**
 * Cron routes that send nurture / digest / sequence mail.
 * Booking + online-join reminders stay on (transactional for people who booked).
 * event-featured stays on for listing expiry maintenance (emails gated separately if needed).
 */
const AUTOMATED_SEQUENCE_CRON_ROUTES = new Set([
  'engagement-emails',
  'post-event-reviews',
  'favourite-sales',
  'organiser-listing-alerts',
  'opportunity-reminders',
  'roster-emails',
  'group-updates',
  'organiser-rankings',
]);

function isAutomatedSequenceCronRoute(route) {
  return AUTOMATED_SEQUENCE_CRON_ROUTES.has(String(route || '').trim());
}

function automatedEmailSequencesStatus(nowMs) {
  const now = nowMs == null ? Date.now() : Number(nowMs);
  const enabled = areAutomatedEmailSequencesEnabled(now);
  const resumesAt = automatedEmailSequencesResumeAt();
  return {
    automatedEmailSequencesEnabled: enabled,
    automatedEmailSequencesPaused: !enabled,
    automatedEmailSequencesResumesAt: resumesAt,
  };
}

/**
 * If sequences are paused, write a 200 skipped response and return true.
 */
function respondIfAutomatedSequencesPaused(res, json) {
  if (areAutomatedEmailSequencesEnabled()) return false;
  const status = automatedEmailSequencesStatus();
  json(res, 200, {
    ok: true,
    skipped: true,
    reason: 'automated_email_sequences_paused',
    message:
      'Automated email sequences are paused until ' +
      status.automatedEmailSequencesResumesAt +
      '. Transactional emails (bookings, auth, claim invites) still send.',
    ...status,
  });
  return true;
}

module.exports = {
  DEFAULT_RESUME_AT,
  AUTOMATED_SEQUENCE_CRON_ROUTES,
  automatedEmailSequencesResumeAt,
  automatedEmailSequencesResumeAtMs,
  areAutomatedEmailSequencesEnabled,
  isAutomatedSequenceCronRoute,
  automatedEmailSequencesStatus,
  respondIfAutomatedSequencesPaused,
};
