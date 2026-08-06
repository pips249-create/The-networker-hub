/**
 * Admin — sponsor / partner click report for monthly packs.
 */
const { requireAdmin, json, setCors, sessionFromRequest } = require('../auth');
const { isSupabaseConfigured } = require('../supabase');
const { getSponsorClicksReport } = require('../sponsor-clicks');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error });

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  if (req.method !== 'GET') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  try {
    const report = await getSponsorClicksReport(req.query || {});
    return json(res, 200, report);
  } catch (e) {
    if (e.code === 'sponsor_clicks_table_missing') {
      return json(res, 503, {
        ok: false,
        error: 'sponsor_clicks_table_missing',
        message: 'Run migrations 234_sponsor_clicks.sql and 235_sponsor_performance_pack.sql in Supabase.',
      });
    }
    return json(res, 500, {
      ok: false,
      error: 'sponsor_clicks_load_failed',
      message: e.message,
    });
  }
};
