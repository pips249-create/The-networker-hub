const { sessionFromRequest, requireAdmin, json, setCors } = require('../_lib/auth');
const { getAdminModeration } = require('../_lib/admin-supabase-data');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error });

  try {
    const report = await getAdminModeration();
    return json(res, 200, { ok: true, ...report });
  } catch (e) {
    return json(res, 500, { ok: false, error: 'moderation_failed', message: e.message });
  }
};
