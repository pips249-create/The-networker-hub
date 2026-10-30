/**
 * Daily: one seed-intro reminder at day 5–7, then pause unresponsive seed in BOH.
 * GET/POST /api/cron/hubert-seed-intro-followups
 */
const { json } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { authorizeCron } = require('../cron-auth');
const { processSeedIntroFollowups } = require('../hubert-seed-intro-followups');

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
    const result = await processSeedIntroFollowups(sb);
    return json(res, 200, { ok: true, ...result });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: 'hubert_seed_intro_followups_failed',
      message: e.message || String(e),
    });
  }
};
