const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { getAdminRevenueTargets } = require('../admin-revenue-targets');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error });

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, configured: false, error: 'supabase_not_configured' });
  }

  try {
    const sb = getSupabaseAdmin();
    const revenueTargets = await getAdminRevenueTargets(sb);
    return json(res, 200, { ok: true, configured: true, revenueTargets });
  } catch (e) {
    return json(res, 500, { ok: false, error: 'revenue_targets_failed', message: e.message });
  }
};
