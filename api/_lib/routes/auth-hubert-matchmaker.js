/**
 * Auth — Hubert Matchmaker search (admin-only until public launch flag).
 */
const { setCors, json, sessionFromRequest, requireAdminLive, isAdminRole } = require('../auth');
const { isSupabaseConfigured, getSupabaseAdmin } = require('../supabase');
const { resolveAttendeeId } = require('../attendee-id');
const { searchMatchmaker, MIN_QUERY_LEN } = require('../hubert-matchmaker-search');

/** Flip via env when Matchmaker is ready for all members. */
function isMatchmakerPublic() {
  return String(process.env.HUBERT_MATCHMAKER_PUBLIC || '').toLowerCase() === 'true';
}

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body && typeof body === 'object' ? body : {};
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = sessionFromRequest(req);
  if (!session) return json(res, 401, { ok: false, error: 'not_authenticated' });

  if (!isMatchmakerPublic()) {
    const gate = await requireAdminLive(session);
    if (!gate.ok) {
      return json(res, gate.status || 403, {
        ok: false,
        error: gate.error || 'admin_only',
        message: 'Hubert Matchmaker is in admin preview.',
      });
    }
  } else if (!isAdminRole(session.role) && !session.email) {
    return json(res, 401, { ok: false, error: 'not_authenticated' });
  }

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured', matches: [] });
  }

  if (req.method === 'GET') {
    return json(res, 200, {
      ok: true,
      public: isMatchmakerPublic(),
      adminPreview: !isMatchmakerPublic(),
      minQueryLength: MIN_QUERY_LEN,
    });
  }

  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const body = parseBody(req);
  const action = String(body.action || 'search').trim().toLowerCase();
  if (action !== 'search') {
    return json(res, 400, { ok: false, error: 'unknown_action' });
  }

  try {
    const sb = getSupabaseAdmin();
    const attendeeId = await resolveAttendeeId(sb, session);
    const result = await searchMatchmaker({
      query: body.query || body.q || '',
      excludeAttendeeId: attendeeId,
    });
    if (!result.ok) {
      const status = result.error === 'query_too_short' ? 400 : 503;
      return json(res, status, result);
    }
    // Strip eventId from client payload if we want stricter privacy — keep for now (not contact PII).
    return json(res, 200, {
      ok: true,
      query: result.query,
      matches: result.matches,
      meta: result.meta,
      adminPreview: !isMatchmakerPublic(),
    });
  } catch (e) {
    console.error('[hubert-matchmaker] search failed', e && e.message ? e.message : e);
    return json(res, 500, {
      ok: false,
      error: 'search_failed',
      message: 'Hubert could not run that search just now.',
      matches: [],
    });
  }
};
