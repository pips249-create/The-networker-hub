const { getOrganiserApi } = require('../organiser-provider');

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
  const api = getOrganiserApi();
  const { json, setCors, requireOrganiserSession } = api;
  const {
    listAlumniInviteStats,
    listEligibleSourceEvents,
    sendAlumniFastPassInvites,
  } = require('../supabase-organiser-alumni-invites');

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  const eventId = String(req.query?.eventId || req.query?.event_id || '').trim();

  try {
    if (req.method === 'GET') {
      if (!eventId) return json(res, 400, { ok: false, error: 'missing_event_id' });
      const action = String(req.query?.action || 'stats').trim().toLowerCase();
      if (action === 'sources') {
        const data = await listEligibleSourceEvents(auth.session, eventId);
        return json(res, 200, { ok: true, ...data });
      }
      const stats = await listAlumniInviteStats(auth.session, eventId);
      return json(res, 200, { ok: true, stats });
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const targetEventId = String(
        body.targetEventId || body.target_event_id || body.eventId || eventId || ''
      ).trim();
      const sourceEventId = String(body.sourceEventId || body.source_event_id || '').trim();
      const sendEmails = body.sendEmails !== false && body.send_emails !== false;

      if (!targetEventId || !sourceEventId) {
        return json(res, 400, { ok: false, error: 'missing_event_ids' });
      }

      const result = await sendAlumniFastPassInvites(auth.session, {
        targetEventId,
        sourceEventId,
        sendEmails,
      });

      const message =
        result.sent > 0
          ? 'Sent ' +
            result.sent +
            ' previous attendee invite' +
            (result.sent === 1 ? '' : 's') +
            ' with locked previous attendee ticket links.'
          : 'Created ' + result.created + ' previous attendee invite' + (result.created === 1 ? '' : 's') + '.';

      return json(res, 200, { ok: true, ...result, message });
    }

    return json(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    return json(res, e.status || 500, {
      ok: false,
      error: e.code || e.message || 'alumni_invites_failed',
      message: e.message || String(e),
    });
  }
};
