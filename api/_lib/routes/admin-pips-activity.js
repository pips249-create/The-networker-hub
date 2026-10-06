const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { canSeePipsActivity, getPipsActivity } = require('../pip-activity');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error });

  if (!canSeePipsActivity(session && session.email)) {
    return json(res, 403, {
      ok: false,
      error: 'forbidden',
      message: "Pip's Activity is only visible to Catherine.",
    });
  }

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, configured: false, error: 'supabase_not_configured' });
  }

  try {
    const activity = await getPipsActivity(getSupabaseAdmin());
    return json(res, 200, { ok: true, activity });
  } catch (e) {
    return json(res, 500, { ok: false, error: 'pips_activity_failed', message: e.message });
  }
};
