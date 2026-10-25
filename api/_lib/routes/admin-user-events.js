/**
 * Command Centre — events published on the Hub by non-staff users.
 * GET /api/admin/user-events?upcoming=1&q=&limit=
 */
const { json, setCors } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { listExternalUserPublishedEvents } = require('../external-user-published-events');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  if (!isSupabaseConfigured()) {
    return json(res, 503, { error: 'supabase_not_configured' });
  }

  const upcomingOnly = String(req.query?.upcoming || '1') !== '0';
  const limit = req.query?.limit;
  const q = req.query?.q;

  try {
    const sb = getSupabaseAdmin();
    const report = await listExternalUserPublishedEvents(sb, { upcomingOnly, limit, q });
    return json(res, 200, { ok: true, ...report });
  } catch (e) {
    console.error('[admin-user-events]', e);
    return json(res, 500, { ok: false, error: 'user_events_failed', message: e.message || String(e) });
  }
};
