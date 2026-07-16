const { getOrganiserApi } = require('../organiser-provider');
const { buildFeaturedQuoteForEvent } = require('../event-featured-quote');

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

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );
}

/** Quote for featured event listing — prorated when the event is sooner than 1 month. */
module.exports = async function handler(req, res) {
  const api = getOrganiserApi();
  const {
    json,
    setCors,
    requireOrganiserSession,
    listGroupsForSession,
    listEventsForSession,
    isPlatformAdmin,
  } = api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  const auth = requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  try {
    const query = req.query || {};
    const body = req.method === 'POST' ? parseBody(req) : {};
    const eventId = String(body.eventId || body.id || query.eventId || query.id || '').trim();
    const planId = String(body.planId || body.plan || query.planId || query.plan || '1month').trim();

    if (!isUuid(eventId)) return json(res, 400, { ok: false, error: 'invalid_event_id' });

    const groups = await listGroupsForSession(auth.session);
    const events = await listEventsForSession(
      auth.session,
      groups.map((g) => g.id),
      []
    );
    const allowed = new Set(events.map((e) => e.id));
    if (!isPlatformAdmin(auth.session) && !allowed.has(eventId)) {
      return json(res, 403, { ok: false, error: 'event_not_owned' });
    }

    const quote = await buildFeaturedQuoteForEvent(eventId, planId);
    return json(res, 200, { ok: true, quote });
  } catch (e) {
    if (e.message === 'event_not_found') {
      return json(res, 404, { ok: false, error: 'event_not_found' });
    }
    return json(res, 500, {
      ok: false,
      error: 'featured_quote_failed',
      message: e.message || String(e),
    });
  }
};
