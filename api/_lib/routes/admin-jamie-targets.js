const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const {
  canSeeJamieTargets,
  canReferMeetingToJamie,
  getJamieTargets,
  addReferredMeeting,
} = require('../jamie-targets');

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body || {};
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET' && req.method !== 'POST') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

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

  const sb = getSupabaseAdmin();

  if (req.method === 'POST') {
    if (!canReferMeetingToJamie(session && session.email)) {
      return json(res, 403, {
        ok: false,
        error: 'forbidden',
        message: 'Only Catherine can refer a meeting to Jamie.',
      });
    }
    try {
      const saved = await addReferredMeeting(sb, session, parseBody(req));
      const targets = await getJamieTargets(sb);
      return json(res, 200, { ok: true, referral: saved, targets });
    } catch (e) {
      const status = e.status || 500;
      return json(res, status, {
        ok: false,
        error: e.code || 'referral_failed',
        message: e.message,
      });
    }
  }

  try {
    const targets = await getJamieTargets(sb);
    return json(res, 200, { ok: true, targets });
  } catch (e) {
    return json(res, 500, { ok: false, error: 'jamie_targets_failed', message: e.message });
  }
};
