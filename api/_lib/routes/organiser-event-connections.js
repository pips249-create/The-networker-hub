/**
 * Organiser event connections email API — preview + send attendee list + history.
 */
const { getOrganiserApi } = require('../organiser-provider');
const { assertOrganiserEmailVerified } = require('../organiser-access-guard');
const {
  getConnectionsPreview,
  sendConnectionsEmail,
  listConnectionsSends,
  getConnectionsAllowance,
} = require('../event-connections-email');

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

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  const verified = await assertOrganiserEmailVerified(auth.session);
  if (!verified.ok) {
    return json(res, verified.status, {
      ok: false,
      error: verified.error,
      message: verified.message,
    });
  }

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      const action = String(
        req.query?.action || url.searchParams.get('action') || ''
      ).trim();
      const organiserId = String(
        req.query?.organiserId ||
          req.query?.organiser_id ||
          req.query?.groupId ||
          url.searchParams.get('organiserId') ||
          url.searchParams.get('organiser_id') ||
          url.searchParams.get('groupId') ||
          ''
      ).trim();

      if (action === 'history' || action === 'analytics') {
        if (!organiserId) return json(res, 400, { ok: false, error: 'missing_organiser_id' });
        const history = await listConnectionsSends(auth.session, organiserId);
        return json(res, 200, { ok: true, ...history });
      }

      if (action === 'allowance') {
        if (!organiserId) return json(res, 400, { ok: false, error: 'missing_organiser_id' });
        const allowance = await getConnectionsAllowance(organiserId);
        return json(res, 200, { ok: true, allowance });
      }

      const eventId = String(
        req.query?.eventId ||
          req.query?.event_id ||
          url.searchParams.get('eventId') ||
          url.searchParams.get('event_id') ||
          ''
      ).trim();
      if (!eventId) return json(res, 400, { ok: false, error: 'missing_event_id' });
      const listKind = String(
        req.query?.listKind ||
          req.query?.list_kind ||
          url.searchParams.get('listKind') ||
          url.searchParams.get('list_kind') ||
          ''
      ).trim();
      const preview = await getConnectionsPreview(auth.session, eventId, listKind);
      return json(res, 200, { ok: true, ...preview });
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const eventId = String(body.eventId || body.event_id || '').trim();
      if (!eventId) return json(res, 400, { ok: false, error: 'missing_event_id' });
      const result = await sendConnectionsEmail(auth.session, {
        eventId,
        organiserNote: body.organiserNote || body.organiser_note || '',
        subject: body.subject || '',
        fromName: body.fromName || body.from_name || body.senderName || body.sender_name || '',
        listKind: body.listKind || body.list_kind || '',
        excludeEmails: body.excludeEmails || body.exclude_emails || body.omitEmails || [],
      });
      return json(res, 200, result);
    }

    return json(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    const status = e.status || 500;
    return json(res, status, {
      ok: false,
      error: e.code || e.message || 'event_connections_failed',
      message: e.message || String(e),
      lastSentAt: e.lastSentAt || null,
    });
  }
};
