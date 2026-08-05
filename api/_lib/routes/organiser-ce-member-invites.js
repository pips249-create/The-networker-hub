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
    listCeMemberInviteStats,
    previewCeMemberInvites,
    sendCeMemberInvites,
  } = require('../supabase-organiser-ce-member-invites');

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
      const action = String(req.query?.action || 'preview').trim().toLowerCase();
      if (action === 'stats') {
        const stats = await listCeMemberInviteStats(auth.session, eventId);
        return json(res, 200, { ok: true, stats });
      }
      const data = await previewCeMemberInvites(auth.session, eventId);
      return json(res, 200, { ok: true, ...data });
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const targetEventId = String(
        body.eventId || body.event_id || body.targetEventId || eventId || ''
      ).trim();
      const sendEmails = body.sendEmails !== false && body.send_emails !== false;
      if (!targetEventId) {
        return json(res, 400, { ok: false, error: 'missing_event_id' });
      }

      const result = await sendCeMemberInvites(auth.session, {
        eventId: targetEventId,
        sendEmails,
      });

      const message =
        result.sent > 0
          ? 'Sent ' +
            result.sent +
            ' member invite' +
            (result.sent === 1 ? '' : 's') +
            '. Members can book without applying.'
          : result.eligible === 0
            ? 'No active members on your Membership list to invite.'
            : 'Created ' +
              result.created +
              ' invite' +
              (result.created === 1 ? '' : 's') +
              (result.skipped ? ' (' + result.skipped + ' already invited).' : '.');

      return json(res, 200, { ok: true, ...result, message });
    }

    return json(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    return json(res, e.status || 500, {
      ok: false,
      error: e.code || e.message || 'ce_member_invites_failed',
      message: e.message || String(e),
    });
  }
};
