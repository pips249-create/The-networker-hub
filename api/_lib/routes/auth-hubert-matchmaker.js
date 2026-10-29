/**
 * Auth — Hubert Matchmaker search + Hub invite (admin-only until public launch flag).
 */
const { setCors, json, sessionFromRequest, requireAdminLive, isAdminRole } = require('../auth');
const { isSupabaseConfigured, getSupabaseAdmin } = require('../supabase');
const { resolveAttendeeId } = require('../attendee-id');
const { searchMatchmaker, MIN_QUERY_LEN } = require('../hubert-matchmaker-search');
const {
  sendHubInvite,
  weeklyCapForSession,
  countRecentInvites,
  sessionUserId,
} = require('../hubert-hub-invite');

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

  try {
    const sb = getSupabaseAdmin();
    const attendeeId = await resolveAttendeeId(sb, session);

    if (action === 'invite') {
      const result = await sendHubInvite({
        sb,
        session,
        inviteeName: body.inviteeName || body.name || '',
        inviteeEmail: body.inviteeEmail || body.email || '',
        note: body.note || body.message || '',
        inviterAttendeeId: attendeeId,
      });
      const status = result.ok
        ? 200
        : result.error === 'quota_exceeded'
          ? 429
          : result.error === 'name_required' ||
              result.error === 'email_invalid' ||
              result.error === 'self_invite'
            ? 400
            : 502;
      return json(res, status, result);
    }

    if (action === 'invite_quota') {
      const cap = weeklyCapForSession(session);
      const used = await countRecentInvites(sb, {
        inviterUserId: sessionUserId(session),
        inviterAttendeeId: attendeeId,
      });
      return json(res, 200, {
        ok: true,
        used,
        remaining: Math.max(0, cap - used),
        cap,
      });
    }

    if (action !== 'search') {
      return json(res, 400, { ok: false, error: 'unknown_action' });
    }

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
    console.error('[hubert-matchmaker] request failed', e && e.message ? e.message : e);
    return json(res, 500, {
      ok: false,
      error: action === 'invite' ? 'invite_failed' : 'search_failed',
      message:
        action === 'invite'
          ? 'Hubert could not send that invite just now.'
          : 'Hubert could not run that search just now.',
      matches: action === 'search' ? [] : undefined,
    });
  }
};
