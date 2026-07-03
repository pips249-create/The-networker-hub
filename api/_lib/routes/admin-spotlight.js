const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { isSupabaseConfigured } = require('../supabase');
const { getAdminSpotlightOverview } = require('../admin-spotlight-data');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error });

  if (req.method !== 'GET') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  try {
    const overview = await getAdminSpotlightOverview();
    return json(res, 200, { ok: true, ...overview, updatedAt: new Date().toISOString() });
  } catch (e) {
    return json(res, 500, { ok: false, error: 'spotlight_failed', message: e.message });
  }
};
