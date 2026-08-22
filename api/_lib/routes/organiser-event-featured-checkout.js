const { getOrganiserApi } = require('../organiser-provider');
const { getSupabaseAdmin } = require('../supabase');
const {
  isStripeCheckoutConfigured,
  createEventFeaturedCheckoutSession,
  siteBaseUrl,
} = require('../stripe-checkout');
const { normalizePlanId, resolveOfferablePlanId } = require('../event-featured-plans');
const { buildFeaturedQuoteForEvent } = require('../event-featured-quote');
const { assertFeaturedSpotlightSlotAvailable } = require('../event-featured-slots');
const {
  fetchSeriesPeerRows,
  isSeriesLiveOnBrowse,
  seriesFeaturedStartCap,
} = require('../event-series-peers');

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

/** Start Stripe Checkout for a one-time featured event listing (up to £55). */
module.exports = async function handler(req, res) {
  const api = getOrganiserApi();
  const {
    json,
    setCors,
    requireOrganiserSession,
    getEventById,
    listGroupsForSession,
    filterOwnedEventIds,
    groupOwnedBySession,
    isPlatformAdmin,
  } = api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const auth = await requireOrganiserSession(req);
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
    const requestedPlanId = normalizePlanId(body.planId || body.plan || body.duration);
    if (!isUuid(eventId)) return json(res, 400, { ok: false, error: 'invalid_event_id' });
    if (!requestedPlanId) return json(res, 400, { ok: false, error: 'invalid_plan' });

    const groups = await listGroupsForSession(auth.session);
    const groupIds = groups.map((g) => g.id);
    if (!isPlatformAdmin(auth.session)) {
      const owned = await filterOwnedEventIds([eventId], groupIds, false);
      if (!owned.length) {
        return json(res, 403, { ok: false, error: 'event_not_owned' });
      }
    }

    const event = await getEventById(eventId);
    if (
      !isPlatformAdmin(auth.session) &&
      event.organiserGroupId &&
      !groupOwnedBySession(auth.session, groups, event.organiserGroupId)
    ) {
      return json(res, 403, { ok: false, error: 'event_not_owned' });
    }

    const status = String(event.status || event.listingStatus || '').toLowerCase();
    const approved = String(event.approvalStatus || event.statusRaw || '').toLowerCase() === 'approved';
    if (status !== 'published' || !approved) {
      return json(res, 400, { ok: false, error: 'event_not_live' });
    }

    const sb = getSupabaseAdmin();
    const { data: rawRow } = await sb.from('events').select('*').eq('id', eventId).maybeSingle();
    const peers = rawRow ? await fetchSeriesPeerRows(sb, rawRow) : [];
    if (!isSeriesLiveOnBrowse(peers)) {
      return json(res, 400, {
        ok: false,
        error: 'event_already_started',
        message:
          'This event has already started — featured placement only runs while it appears on the events browse page.',
      });
    }

    const eventStartsAt = seriesFeaturedStartCap(peers) || (rawRow && rawRow.starts_at) || event.date || null;
    const planId = resolveOfferablePlanId(requestedPlanId, eventStartsAt);

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
            ' featured spotlight places are currently taken. Your event stays live — you can upgrade from Promote in your dashboard when a slot opens.',
          featuredSlots: slots,
        });
      }
      throw slotErr;
    }

    const siteUrl = siteBaseUrl();
    const title = encodeURIComponent(event.title || '');
    const returnTo = String(body.returnTo || body.return_to || '').trim().toLowerCase();
    const fromDashboard = returnTo === 'social' || returnTo === 'dashboard';
    const successBase =
      siteUrl +
      '/organiser/event-featured-success?session_id={CHECKOUT_SESSION_ID}&id=' +
      encodeURIComponent(eventId) +
      '&plan=' +
      encodeURIComponent(planId) +
      (title ? '&title=' + title : '');
    const successUrl = fromDashboard ? successBase + '&return=social' : successBase;
    const cancelUrl = fromDashboard
      ? siteUrl + '/organiser/?featured=cancelled#social'
      : siteUrl +
        '/organiser/event-published?ids=' +
        encodeURIComponent(eventId) +
        (title ? '&title=' + title : '') +
        '&featured=cancelled';

    const quote = await buildFeaturedQuoteForEvent(eventId, planId);

    const checkoutSession = await createEventFeaturedCheckoutSession({
      email: auth.session.email,
      eventId,
      planId,
      eventTitle: event.title,
      amountPence: quote.amountPence,
      lineItemDescription: quote.lineItemDescription + ' — "' + String(event.title || 'Event').trim() + '"',
      successUrl,
      cancelUrl,
    });

    return json(res, 200, {
      ok: true,
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
      quote,
    });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: 'checkout_failed',
      message: e.message || String(e),
    });
  }
};
