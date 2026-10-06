const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { canSeeJamieTargets, getJamieTargets } = require('../jamie-targets');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error });

  if (!canSeeJamieTargets(session && session.email)) {
    return json(res, 403, {
      ok: false,
      error: 'forbidden',
      message: "Jamie's targets are only visible to Catherine and Jamie.",
    });
  }

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, configured: false, error: 'supabase_not_configured' });
  }

  try {
    const targets = await getJamieTargets(getSupabaseAdmin());
    return json(res, 200, { ok: true, targets });
  } catch (e) {
    return json(res, 500, { ok: false, error: 'jamie_targets_failed', message: e.message });
  }
};
