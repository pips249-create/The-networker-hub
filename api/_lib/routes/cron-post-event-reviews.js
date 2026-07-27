const { json } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { authorizeCron } = require('../cron-auth');
const { sendDuePostEventReviewEmails, sendDuePostEventReviewReminderEmails } = require('../engagement-emails');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  if (!authorizeCron(req, res)) return;

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  try {
    const sb = getSupabaseAdmin();
    const postReview = await sendDuePostEventReviewEmails(sb);
    const postReviewReminder = await sendDuePostEventReviewReminderEmails(sb);
    return json(res, 200, { ok: true, postReview, postReviewReminder });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: 'post_event_reviews_failed',
      message: e.message || String(e),
    });
  }
};
