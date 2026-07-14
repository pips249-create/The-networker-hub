const { getOrganiserApi } = require('../organiser-provider');
const {
  isStripeCheckoutConfigured,
  createEventFeaturedCheckoutSession,
  siteBaseUrl,
} = require('../stripe-checkout');
const { normalizePlanId } = require('../event-featured-plans');
const { assertFeaturedSpotlightSlotAvailable } = require('../event-featured-slots');

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

/** Start Stripe Checkout for a featured event listing (£55/month). */
module.exports = async function handler(req, res) {
  const api = getOrganiserApi();
  const {
    json,
    setCors,
    requireOrganiserSession,
    getEventById,
    listGroupsForSession,
    listEventsForSession,
    groupOwnedBySession,
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
    return json(res, 503, {
      ok: false,
      error: 'stripe_not_configured',
      message:
        'Add STRIPE_SECRET_KEY (sk_test_… for test mode) to your environment, then redeploy or restart vercel dev.',
    });
  }

  try {
    const body = parseBody(req);
    const eventId = String(body.eventId || body.id || '').trim();
    const planId = normalizePlanId(body.planId || body.plan || body.duration);
    if (!isUuid(eventId)) return json(res, 400, { ok: false, error: 'invalid_event_id' });
    if (!planId) return json(res, 400, { ok: false, error: 'invalid_plan' });

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
    if (
      !isPlatformAdmin(auth.session) &&
      event.organiserGroupId &&
      !groupOwnedBySession(auth.session, groups, event.organiserGroupId) &&
      !allowed.has(eventId)
    ) {
      return json(res, 403, { ok: false, error: 'event_not_owned' });
    }

    const status = String(event.status || event.listingStatus || '').toLowerCase();
    const approved = String(event.approvalStatus || event.statusRaw || '').toLowerCase() === 'approved';
    if (status !== 'published' || !approved) {
      return json(res, 400, { ok: false, error: 'event_not_live' });
    }

    try {
      await assertFeaturedSpotlightSlotAvailable(eventId);
    } catch (slotErr) {
      if (slotErr.code === 'featured_slots_full') {
        const slots = slotErr.slots || {};
        return json(res, 409, {
          ok: false,
          error: 'featured_slots_full',
          message:
            'All ' +
            (slots.max || 12) +
            ' featured spotlight places are currently taken. Your event stays live — try again when a slot opens, or choose a shorter plan later.',
          featuredSlots: slots,
        });
      }
      throw slotErr;
    }

    const siteUrl = siteBaseUrl();
    const title = encodeURIComponent(event.title || '');
    const checkoutSession = await createEventFeaturedCheckoutSession({
      email: auth.session.email,
      eventId,
      planId,
      eventTitle: event.title,
      successUrl:
        siteUrl +
        '/organiser/event-featured-success?session_id={CHECKOUT_SESSION_ID}&id=' +
        encodeURIComponent(eventId) +
        '&plan=' +
        encodeURIComponent(planId) +
        (title ? '&title=' + title : ''),
      cancelUrl:
        siteUrl +
        '/organiser/event-published?ids=' +
        encodeURIComponent(eventId) +
        (title ? '&title=' + title : '') +
        '&featured=cancelled',
    });

    return json(res, 200, {
      ok: true,
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: 'checkout_failed',
      message: e.message || String(e),
    });
  }
};
