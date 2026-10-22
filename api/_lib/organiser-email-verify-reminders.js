/**
 * One follow-up when a signup still has not confirmed their email.
 * Runs from the hourly email-verify-reminders cron (transactional — not nurture pause).
 */
const { claimRowTimestamp, releaseRowTimestamp } = require('./email-send-claim');
const { sendOrganiserEmailVerification } = require('./organiser-email-verification');
const { getHubAccount } = require('./supabase-auth');
const {
  REMINDER_SLUG,
  AFTER_MS,
  UNTIL_MS,
  emailVerifyReminderSkipReason,
} = require('./organiser-email-verify-reminder-policy');

const BATCH = 40;

async function loadAuthUser(sb, userId) {
  const uid = String(userId || '').trim();
  if (!uid) return null;
  const { data, error } = await sb.auth.admin.getUserById(uid);
  if (error || !data?.user) return null;
  return data.user;
}

async function sendDueOrganiserEmailVerifyReminders(sb, options) {
  const now = options && options.now != null ? Number(options.now) : Date.now();
  const newest = new Date(now - AFTER_MS).toISOString();
  const oldest = new Date(now - UNTIL_MS).toISOString();
  const result = { sent: 0, skipped: 0, errors: [], checked: 0 };

  const { data, error } = await sb
    .from('hub_accounts')
    .select(
      'user_id, display_name, created_at, organiser_email_verified_at, organiser_email_verify_reminder_sent_at'
    )
    .is('organiser_email_verified_at', null)
    .is('organiser_email_verify_reminder_sent_at', null)
    .gte('created_at', oldest)
    .lte('created_at', newest)
    .order('created_at', { ascending: true })
    .limit(BATCH);
  if (error) throw new Error(error.message);

  const rows = data || [];
  result.checked = rows.length;

  for (const row of rows) {
    const userId = String(row.user_id || '').trim();
    const skip = emailVerifyReminderSkipReason({
      createdAt: row.created_at,
      verifiedAt: row.organiser_email_verified_at,
      reminderSentAt: row.organiser_email_verify_reminder_sent_at,
      now,
    });
    if (skip || !userId) {
      result.skipped += 1;
      continue;
    }

    const claimedAt = new Date(now).toISOString();
    let claimed = false;
    try {
      claimed = await claimRowTimestamp(sb, {
        table: 'hub_accounts',
        id: userId,
        idColumn: 'user_id',
        column: 'organiser_email_verify_reminder_sent_at',
        claimedAt,
        previousValue: null,
      });
      if (!claimed) {
        result.skipped += 1;
        continue;
      }

      // Re-check after claim so a confirm that won the race is not undone.
      const hub = await getHubAccount(userId);
      if (hub?.organiser_email_verified_at) {
        result.skipped += 1;
        continue;
      }

      const authUser = await loadAuthUser(sb, userId);
      const email = String(authUser?.email || '')
        .trim()
        .toLowerCase();
      if (!email) {
        await releaseRowTimestamp(sb, {
          table: 'hub_accounts',
          id: userId,
          idColumn: 'user_id',
          column: 'organiser_email_verify_reminder_sent_at',
          claimedAt,
        });
        result.skipped += 1;
        continue;
      }

      const name =
        String(row.display_name || '').trim() ||
        String(authUser.user_metadata?.full_name || '').trim() ||
        email.split('@')[0];

      await sendOrganiserEmailVerification({
        userId,
        email,
        name,
        slug: REMINDER_SLUG,
      });
      result.sent += 1;
    } catch (e) {
      if (claimed && e.code !== 'already_verified') {
        try {
          await releaseRowTimestamp(sb, {
            table: 'hub_accounts',
            id: userId,
            idColumn: 'user_id',
            column: 'organiser_email_verify_reminder_sent_at',
            claimedAt,
          });
        } catch (_) {
          /* keep claimed so a partial failure does not loop forever */
        }
      }
      if (
        e.code === 'emails_disabled' ||
        e.code === 'email_not_configured' ||
        e.code === 'already_verified'
      ) {
        result.skipped += 1;
      } else {
        result.errors.push({
          user_id: userId,
          message: e.message || String(e),
        });
      }
    }
  }

  return result;
}

module.exports = {
  REMINDER_SLUG,
  AFTER_MS,
  UNTIL_MS,
  emailVerifyReminderSkipReason,
  sendDueOrganiserEmailVerifyReminders,
};
