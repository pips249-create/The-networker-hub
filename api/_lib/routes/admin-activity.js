const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { fetchEntityActivity } = require('../entity-activity-log');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error });

  let entityType = '';
  let entityId = '';
  let organiserId = '';
  let limit = 40;
  if (req.url) {
    try {
      const params = new URL(req.url, 'https://internal.local').searchParams;
      entityType = params.get('entityType') || params.get('entity_type') || '';
      entityId = params.get('entityId') || params.get('entity_id') || '';
      organiserId = params.get('organiserId') || params.get('organiser_id') || '';
      limit = params.get('limit') || 40;
    } catch {
      /* keep defaults */
    }
  }

  try {
    const report = await fetchEntityActivity({ entityType, entityId, organiserId, limit });
    return json(res, 200, { ok: true, ...report });
  } catch (e) {
    return json(res, 500, { ok: false, error: 'activity_failed', message: e.message });
  }
};
