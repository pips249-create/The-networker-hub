const { getOrganiserApi } = require('../organiser-provider');
const { isStripeCheckoutConfigured, retrieveCheckoutSession } = require('../stripe-checkout');
const { handleEventFeaturedCheckout } = require('../event-featured');

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

/** Fallback when Stripe webhook is delayed — confirm featured checkout and activate listing. */
module.exports = async function handler(req, res) {
  const api = getOrganiserApi();
  const {
    json,
    setCors,
    requireOrganiserSession,
    getEventById,
    listGroupsForSession,
    listEventsForSession,
    isPlatformAdmin,
  } = api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const auth = requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  if (!isStripeCheckoutConfigured()) {
    return json(res, 503, { ok: false, error: 'stripe_not_configured' });
  }

  try {
    const body = parseBody(req);
    const sessionId = String(body.sessionId || body.session_id || '').trim();
    if (!sessionId) return json(res, 400, { ok: false, error: 'missing_session_id' });

    const session = await retrieveCheckoutSession(sessionId);
    const eventId = String(session?.metadata?.event_id || '').trim();
    if (!isUuid(eventId)) {
      return json(res, 400, { ok: false, error: 'invalid_checkout_session' });
    }

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

    const event = await getEventById(eventId);
    const result = await handleEventFeaturedCheckout(session);
    return json(res, 200, { ok: true, result, event });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: 'featured_complete_failed',
      message: e.message || String(e),
    });
  }
};
