const { getOrganiserApi } = require('../organiser-provider');
const { isUuid } = require('../uuid');

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

function collectEventIds(body, queryEventId) {
  const fromArray = Array.isArray(body.eventIds)
    ? body.eventIds
    : Array.isArray(body.event_ids)
      ? body.event_ids
      : [];
  const single = String(
    body.eventId || body.event_id || body.targetEventId || queryEventId || ''
  ).trim();
  const ids = fromArray
    .map((id) => String(id || '').trim())
    .concat(single ? [single] : [])
    .filter((id) => isUuid(id));
  return Array.from(new Set(ids));
}

function buildSendMessage(result) {
  const dateCount = Array.isArray(result.eventIds) ? result.eventIds.length : 1;
  const dateSuffix =
    dateCount > 1 ? ' across ' + dateCount + ' dates' : '';
  if (result.sent > 0) {
    return (
      'Sent ' +
      result.sent +
      ' member invite' +
      (result.sent === 1 ? '' : 's') +
      dateSuffix +
      '. Members can book without applying.'
    );
  }
  if (result.eligible === 0) {
    return 'No active members on your Membership list to invite.';
  }
  return (
    'Created ' +
    result.created +
    ' invite' +
    (result.created === 1 ? '' : 's') +
    dateSuffix +
    (result.skipped ? ' (' + result.skipped + ' already invited).' : '.')
  );
}

module.exports = async function handler(req, res) {
  const api = getOrganiserApi();
  const { json, setCors, requireOrganiserSession } = api;
  const {
    listCeMemberInviteStats,
    previewCeMemberInvites,
    sendCeMemberInvites,
    sendCeMemberInvitesForEvents,
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
      const eventIds = collectEventIds(body, eventId);
      const sendEmails = body.sendEmails !== false && body.send_emails !== false;
      if (!eventIds.length) {
        return json(res, 400, { ok: false, error: 'missing_event_id' });
      }

      const result =
        eventIds.length === 1
          ? await sendCeMemberInvites(auth.session, {
              eventId: eventIds[0],
              sendEmails,
            })
          : await sendCeMemberInvitesForEvents(auth.session, {
              eventIds,
              sendEmails,
            });

      return json(res, 200, {
        ok: true,
        ...result,
        eventIds: result.eventIds || eventIds,
        message: buildSendMessage({
          ...result,
          eventIds: result.eventIds || eventIds,
        }),
      });
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
