const { json } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { drainDueRosterEmails } = require('../organiser-roster-email-queue');
const { authorizeCron } = require('../cron-auth');

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
    const aggregate = await drainDueRosterEmails(sb, { batchSize: 80, maxBatches: 12 });

    return json(res, 200, { ok: true, ...aggregate });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: 'roster_emails_failed',
      message: e.message || String(e),
    });
  }
};
