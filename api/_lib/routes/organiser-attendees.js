const { getOrganiserApi } = require('../organiser-provider');

module.exports = async function handler(req, res) {
  const api = getOrganiserApi();
  const { json, setCors, getOrganiserWorkspace, listAttendeesForOrganiserEvents, airtableSetupHint } =
    api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  if (!listAttendeesForOrganiserEvents) {
    return json(res, 501, { error: 'attendees_not_supported' });
  }

  try {
    const ws = await getOrganiserWorkspace(req);
    if (!ws.ok && ws.error === 'not_authenticated') {
      return json(res, ws.status || 401, { error: ws.error });
    }
    if (!ws.ok) {
      return json(res, ws.status || 500, {
        error: ws.error,
        message: ws.message,
        attendees: [],
      });
    }

    const url = new URL(req.url, 'http://localhost');
    const filterEventId = url.searchParams.get('eventId') || 'all';
    const eventIds = (ws.events || []).map((e) => e.id);
    let attendees = [];
    try {
      attendees = await listAttendeesForOrganiserEvents(eventIds, filterEventId);
    } catch (e) {
      return json(res, 500, {
        error: 'attendees_fetch_failed',
        message: e.message,
        attendees: [],
      });
    }

    return json(res, 200, {
      ok: true,
      attendees,
      eventCount: eventIds.length,
      airtable: airtableSetupHint && airtableSetupHint('events'),
    });
  } catch (e) {
    return json(res, 500, { error: 'server_error', message: e.message, attendees: [] });
  }
};
