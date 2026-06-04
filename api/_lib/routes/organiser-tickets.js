const {
  json,
  setCors,
  requireOrganiserSession,
  listGroupsForSession,
  listEventsForSession,
  listTicketsForSession,
  isPlatformAdmin,
  createTicket,
  airtableSetupHint,
} = require('../organiser');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  async function ownedEventIds() {
    const groups = await listGroupsForSession(auth.session);
    const events = await listEventsForSession(
      auth.session,
      groups.map((g) => g.id),
      []
    );
    return new Set(events.map((e) => e.id));
  }

  if (req.method === 'GET') {
    const eventId = String(req.query?.eventId || '').trim();
    try {
      const allowed = await ownedEventIds();
      const ids = eventId ? [eventId].filter((id) => allowed.has(id)) : [...allowed];
      const tickets = await listTicketsForSession(auth.session, ids);
      return json(res, 200, { ok: true, tickets });
    } catch (e) {
      return json(res, e.status || 500, {
        error: 'tickets_fetch_failed',
        message: e.message,
        airtable: airtableSetupHint('tickets'),
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
    const eventId = String(body.eventId || '').trim();
    const name = String(body.name || '').trim();
    const price = body.price;
    const description = String(body.description || '').trim();
    const status = String(body.status || 'Available').trim();
    const quantityAvailable = body.quantityAvailable;

    if (!eventId) return json(res, 400, { error: 'missing_event' });
    if (!name) return json(res, 400, { error: 'missing_name' });

    try {
      const allowed = await ownedEventIds();
      if (!isPlatformAdmin(auth.session) && !allowed.has(eventId)) {
        return json(res, 403, { error: 'event_not_owned' });
      }
      const ticket = await createTicket({
        eventId,
        name,
        price,
        description,
        status,
        quantityAvailable,
      });
      return json(res, 201, { ok: true, ticket });
    } catch (e) {
      return json(res, e.status || 500, {
        error: 'ticket_create_failed',
        message: e.message,
        airtable: airtableSetupHint('tickets'),
      });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
