const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { getAdminDemand } = require('../admin-demand');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error });

  let period = '30d';
  if (req.url) {
    try {
      const params = new URL(req.url, 'https://internal.local').searchParams;
      period = params.get('period') || period;
    } catch {
      /* keep default */
    }
  }

  try {
    const report = await getAdminDemand(period);
    return json(res, 200, { ok: true, ...report });
  } catch (e) {
    return json(res, 500, { ok: false, error: 'demand_failed', message: e.message });
  }
};
