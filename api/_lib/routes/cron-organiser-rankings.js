const { json } = require('../auth');
const { authorizeCron } = require('../cron-auth');
const { isSupabaseConfigured } = require('../supabase');
const { runMonthlyOrganiserRankingSnapshot } = require('../organiser-ranking-snapshot');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  if (!authorizeCron(req, res)) return;

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  try {
    const result = await runMonthlyOrganiserRankingSnapshot({
      triggeredBy: 'cron',
      sendEmails: true,
    });
    return json(res, 200, result);
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: 'organiser_ranking_snapshot_failed',
      message: e.message || String(e),
    });
  }
};
