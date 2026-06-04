const {
  json,
  setCors,
  requireOrganiserSession,
  getOrganiserWorkspace,
  airtableSetupHint,
} = require('../organiser');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  try {
    const ws = await getOrganiserWorkspace(req);
    if (!ws.ok && ws.error === 'not_authenticated') {
      return json(res, ws.status || 401, { error: ws.error });
    }
    if (!ws.ok && ws.error === 'missing_email') {
      return json(res, ws.status || 403, { error: ws.error });
    }
    if (!ws.ok) {
      return json(res, ws.status || 500, {
        error: ws.error,
        message: ws.message,
        groups: ws.groups,
        airtable: airtableSetupHint('events'),
      });
    }

    return json(res, 200, {
      ok: true,
      user: {
        email: ws.session.email,
        name: ws.session.name || '',
        role: ws.session.role,
        sub: ws.session.sub,
      },
      groups: ws.groups,
      events: ws.events,
      tickets: ws.tickets,
      hubView: ws.hubView,
      adminView: ws.adminView,
      canOrganise: ws.canOrganise,
      stats: {
        groups: ws.groups.length,
        events: ws.events.length,
        tickets: ws.tickets.length,
      },
      groupsError: ws.groupsError,
      airtable: {
        groups: airtableSetupHint('groups'),
        events: airtableSetupHint('events'),
        tickets: airtableSetupHint('tickets'),
      },
    });
  } catch (e) {
    return json(res, 500, { error: 'server_error', message: e.message });
  }
};
