/**
 * Pure eligibility rules for the confirm-email reminder (no DB / Resend deps).
 */
const REMINDER_SLUG = 'organiser_email_verify_reminder';
const AFTER_MS = 3 * 60 * 60 * 1000;
const UNTIL_MS = 48 * 60 * 60 * 1000;

function emailVerifyReminderSkipReason({
  createdAt,
  verifiedAt,
  reminderSentAt,
  now,
} = {}) {
  if (verifiedAt) return 'already_verified';
  if (reminderSentAt) return 'already_sent';
  const created = Date.parse(createdAt || '');
  if (!Number.isFinite(created)) return 'missing_created_at';
  const age = (now == null ? Date.now() : Number(now)) - created;
  if (age < AFTER_MS) return 'too_soon';
  if (age >= UNTIL_MS) return 'too_old';
  return '';
}

module.exports = {
  REMINDER_SLUG,
  AFTER_MS,
  UNTIL_MS,
  emailVerifyReminderSkipReason,
};
