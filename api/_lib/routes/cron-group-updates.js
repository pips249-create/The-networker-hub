/**
 * Cron: drain queued organiser monthly group-update emails.
 */
const { json } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { drainDueGroupUpdateEmails } = require('../organiser-group-updates');
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
    const result = await drainDueGroupUpdateEmails(sb, {
      maxBatches: 8,
      batchSize: 40,
      maxRuntimeMs: 45000,
    });
    return json(res, 200, { ok: true, ...result });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: 'group_updates_drain_failed',
      message: e.message || String(e),
    });
  }
};
