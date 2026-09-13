/**
 * Pause for automated / nurture email sequences.
 *
 * Soft-launch used to auto-resume on 5 September 2026. That silent turn-on
 * flooded Resend after the date passed — default is now PAUSED until you
 * explicitly set AUTOMATED_EMAIL_SEQUENCES_FORCE_ON=true in Vercel.
 *
 * Does NOT block transactional mail triggered by user actions
 * (account welcome, booking confirmations, password reset, claim invites, etc.).
 * Those send from auth/checkout/organiser routes — not from the nurture crons below.
 *
 * Override:
 *   AUTOMATED_EMAIL_SEQUENCES_FORCE_ON=true   — resume nurture/digest crons
 *   AUTOMATED_EMAIL_SEQUENCES_FORCE_OFF=true  — hard kill even if FORCE_ON
 *   AUTOMATED_EMAIL_SEQUENCES_RESUME_AT=ISO   — optional date gate (only when set)
 *
 * Hubert monthly picks stay separately gated:
 *   HUBERT_EVENT_CONCIERGE_EMAILS_ENABLED=true
 */

const DEFAULT_RESUME_AT = null;

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
  const iso = automatedEmailSequencesResumeAt();
  return iso ? Date.parse(iso) : NaN;
}

function areAutomatedEmailSequencesEnabled(nowMs) {
  if (parseEnvFlag('AUTOMATED_EMAIL_SEQUENCES_FORCE_OFF')) return false;
  if (parseEnvFlag('AUTOMATED_EMAIL_SEQUENCES_FORCE_ON')) return true;
  const resumeMs = automatedEmailSequencesResumeAtMs();
  if (Number.isFinite(resumeMs)) {
    const now = nowMs == null ? Date.now() : Number(nowMs);
    return now >= resumeMs;
  }
  // No FORCE_ON and no explicit RESUME_AT — stay paused.
  return false;
}

/**
 * Hubert monthly event picks — opt-in only. The engagement cron can run other
 * nurture mail while this stays off.
 *
 *   HUBERT_EVENT_CONCIERGE_EMAILS_ENABLED=true
 *   HUBERT_EVENT_CONCIERGE_EMAILS_FORCE_OFF=true  (explicit kill switch)
 */
function areHubertEventConciergeEmailsEnabled() {
  if (parseEnvFlag('HUBERT_EVENT_CONCIERGE_EMAILS_FORCE_OFF')) return false;
  return parseEnvFlag('HUBERT_EVENT_CONCIERGE_EMAILS_ENABLED');
}

function hubertEventConciergeEmailsStatus() {
  const enabled = areHubertEventConciergeEmailsEnabled();
  return {
    hubertEventConciergeEmailsEnabled: enabled,
    hubertEventConciergeEmailsPaused: !enabled,
  };
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
  const resumeHint = status.automatedEmailSequencesResumesAt
    ? 'until ' + status.automatedEmailSequencesResumesAt
    : 'until AUTOMATED_EMAIL_SEQUENCES_FORCE_ON=true';
  json(res, 200, {
    ok: true,
    skipped: true,
    reason: 'automated_email_sequences_paused',
    message:
      'Automated email sequences are paused ' +
      resumeHint +
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
  areHubertEventConciergeEmailsEnabled,
  hubertEventConciergeEmailsStatus,
  isAutomatedSequenceCronRoute,
  automatedEmailSequencesStatus,
  respondIfAutomatedSequencesPaused,
};
