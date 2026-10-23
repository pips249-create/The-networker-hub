/**
 * Pure eligibility rules for the confirm-email reminder (no DB / Resend deps).
 *
 * Reminder is only for people who already started inbox confirmation (signup
 * or enable/resend issued a code). Soft-provisioned organiser logins create
 * hub_accounts without a verify token — they must not get "confirm your email".
 */
const REMINDER_SLUG = 'organiser_email_verify_reminder';
const AFTER_MS = 3 * 60 * 60 * 1000;
const UNTIL_MS = 48 * 60 * 60 * 1000;

function emailVerifyReminderSkipReason({
  createdAt,
  verifiedAt,
  reminderSentAt,
  verifyTokenHash,
  now,
} = {}) {
  if (verifiedAt) return 'already_verified';
  if (reminderSentAt) return 'already_sent';
  // No prior confirm code ⇒ never started create-account / enable flow.
  if (!String(verifyTokenHash || '').trim()) return 'never_started_verify';
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
