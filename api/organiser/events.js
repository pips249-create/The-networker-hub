const {
  json,
  setCors,
  requireOrganiserSession,
  listGroupsForSession,
  listEventsForSession,
  groupOwnedBySession,
  createEvent,
  airtableSetupHint,
} = require('../_lib/organiser');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  if (req.method === 'GET') {
    try {
      const groups = await listGroupsForSession(auth.session);
      const groupIds = groups.map((g) => g.id);
      const events = await listEventsForSession(auth.session, groupIds, []);
      return json(res, 200, { ok: true, events, groups });
    } catch (e) {
      return json(res, e.status || 500, {
        error: 'events_fetch_failed',
        message: e.message,
        airtable: airtableSetupHint('events'),
      });
    }
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    const title = String(body.title || '').trim();
    const groupId = String(body.organiserGroupId || body.groupId || '').trim();
    const date = body.date || body.dateTime || '';
    const type = String(body.type || body.format || 'Networking Event').trim();
    const description = String(body.description || '').trim();

    if (!title) return json(res, 400, { error: 'missing_title' });
    if (!groupId) return json(res, 400, { error: 'missing_group' });

    try {
      const groups = await listGroupsForSession(auth.session);
      if (!groupOwnedBySession(auth.session, groups, groupId)) {
        return json(res, 403, { error: 'group_not_owned' });
      }
      const event = await createEvent({
        email: auth.session.email,
        groupId,
        title,
        date,
        type,
        description,
      });
      return json(res, 201, { ok: true, event });
    } catch (e) {
      return json(res, e.status || 500, {
        error: 'event_create_failed',
        message: e.message,
        airtable: airtableSetupHint('events'),
      });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
