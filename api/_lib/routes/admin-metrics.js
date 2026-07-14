const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { getAdminDashboard } = require('../admin-supabase-data');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error });

  try {
    const url = new URL(req.url || '/', 'http://localhost');
    const light =
      url.searchParams.get('light') === '1' || String((req.query && req.query.light) || '') === '1';
    const report = await getAdminDashboard({ light });
    return json(res, 200, { ok: true, ...report });
  } catch (e) {
    return json(res, 500, { ok: false, error: 'metrics_failed', message: e.message });
  }
};
