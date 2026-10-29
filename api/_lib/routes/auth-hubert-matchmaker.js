/**
 * Auth — Hubert Matchmaker search, intro requests, and Hub invites
 * (admin-only until public launch flag).
 */
const { setCors, json, sessionFromRequest, requireAdminLive, isAdminRole } = require('../auth');
const { isSupabaseConfigured, getSupabaseAdmin } = require('../supabase');
const { resolveAttendeeId } = require('../attendee-id');
const { searchMatchmaker, MIN_QUERY_LEN } = require('../hubert-matchmaker-search');
const {
  createIntroRequest,
  respondToIntro,
  listIntrosForSession,
  getIntroThread,
  postIntroMessage,
  TOPIC_MIN_LEN,
  INTROS_PER_WEEK,
} = require('../hubert-intro-requests');
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

async function gateMatchmaker(session, res) {
  if (!session) {
    json(res, 401, { ok: false, error: 'not_authenticated' });
    return false;
  }
  if (!isMatchmakerPublic()) {
    const gate = await requireAdminLive(session);
    if (!gate.ok) {
      json(res, gate.status || 403, {
        ok: false,
        error: gate.error || 'admin_only',
        message: 'Hubert Matchmaker is in admin preview.',
      });
      return false;
    }
  } else if (!isAdminRole(session.role) && !session.email) {
    json(res, 401, { ok: false, error: 'not_authenticated' });
    return false;
  }
  return true;
}

function mapIntroError(e) {
  const code = e && e.code ? e.code : 'failed';
  const statusMap = {
    topic_too_short: 400,
    topic_too_generic: 400,
    invalid_target: 400,
    cannot_intro_self: 400,
    intro_quota_exceeded: 429,
    intro_already_pending: 409,
    target_not_found: 404,
    target_email_missing: 400,
    attendee_not_found: 400,
    intro_email_failed: 502,
    invalid_or_expired_token: 400,
    intro_not_found: 404,
    intro_not_pending: 409,
    invalid_decision: 400,
    forbidden: 403,
    thread_not_open: 409,
    invalid_message: 400,
    no_contact_details: 400,
    missing_intro_id: 400,
  };
  return {
    status: statusMap[code] || 500,
    error: code,
    message: e && e.message ? e.message : 'Something went wrong.',
  };
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = sessionFromRequest(req);
  if (!(await gateMatchmaker(session, res))) return;

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured', matches: [] });
  }

  if (req.method === 'GET') {
    let action = 'meta';
    try {
      const url = new URL(req.url, 'https://internal.local');
      action = String(url.searchParams.get('action') || 'meta').trim().toLowerCase();
    } catch {
      action = 'meta';
    }

    if (action === 'list' || action === 'intros') {
      try {
        const lists = await listIntrosForSession(session);
        return json(res, 200, { ok: true, ...lists, introQuotaPerWeek: INTROS_PER_WEEK });
      } catch (e) {
        const mapped = mapIntroError(e);
        return json(res, mapped.status, { ok: false, error: mapped.error, message: mapped.message });
      }
    }

    if (action === 'thread') {
      try {
        const url = new URL(req.url, 'https://internal.local');
        const introId = url.searchParams.get('introId') || url.searchParams.get('id') || '';
        const thread = await getIntroThread(session, introId);
        return json(res, 200, { ok: true, ...thread });
      } catch (e) {
        const mapped = mapIntroError(e);
        return json(res, mapped.status, { ok: false, error: mapped.error, message: mapped.message });
      }
    }

    return json(res, 200, {
      ok: true,
      public: isMatchmakerPublic(),
      adminPreview: !isMatchmakerPublic(),
      minQueryLength: MIN_QUERY_LEN,
      topicMinLength: TOPIC_MIN_LEN,
      introQuotaPerWeek: INTROS_PER_WEEK,
    });
  }

  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const body = parseBody(req);
  const action = String(body.action || 'search').trim().toLowerCase();

  if (action === 'invite' || action === 'invite_quota') {
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
    } catch (e) {
      console.error('[hubert-matchmaker] invite failed', e && e.message ? e.message : e);
      return json(res, 500, {
        ok: false,
        error: 'invite_failed',
        message: 'Hubert could not send that invite just now.',
      });
    }
  }

  if (action === 'search') {
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
  }

  if (action === 'request' || action === 'request_intro') {
    try {
      const intro = await createIntroRequest(session, body);
      return json(res, 200, { ok: true, intro });
    } catch (e) {
      console.error('[hubert-matchmaker] request failed', e && e.message ? e.message : e);
      const mapped = mapIntroError(e);
      return json(res, mapped.status, { ok: false, error: mapped.error, message: mapped.message });
    }
  }

  if (action === 'accept' || action === 'decline') {
    try {
      const result = await respondToIntro({
        session,
        introId: body.introId || body.id,
        token: body.token,
        decision: action,
        reason: body.reason,
      });
      return json(res, 200, { ok: true, ...result });
    } catch (e) {
      const mapped = mapIntroError(e);
      return json(res, mapped.status, { ok: false, error: mapped.error, message: mapped.message });
    }
  }

  if (action === 'post_message' || action === 'message') {
    try {
      const message = await postIntroMessage(session, body.introId || body.id, body.body || body.message);
      return json(res, 200, { ok: true, message });
    } catch (e) {
      const mapped = mapIntroError(e);
      return json(res, mapped.status, { ok: false, error: mapped.error, message: mapped.message });
    }
  }

  return json(res, 400, { ok: false, error: 'unknown_action' });
};
