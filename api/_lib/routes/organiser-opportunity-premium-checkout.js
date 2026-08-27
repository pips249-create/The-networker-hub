const { getOrganiserApi } = require('../organiser-provider');
const { jsonPublicError } = require('../public-error');
const {
  isStripeCheckoutConfigured,
  createOpportunityPremiumCheckoutSession,
  siteBaseUrl,
} = require('../stripe-checkout');
const { assertPremiumSpotlightSlotAvailable } = require('../opportunity-premium-slots');
const { isNetworkMarketingType } = require('../opportunity-moderation');

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

/** Start Stripe Checkout for a one-time £55 premium opportunity listing (up to 30 days). */
module.exports = async function handler(req, res) {
  const api = getOrganiserApi();
  const { json, setCors, requireOrganiserSession, getOpportunityById, opportunityOwnedBySession, isPlatformAdmin } =
    api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const auth = await requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  if (!isStripeCheckoutConfigured()) {
    return json(res, 503, { ok: false, error: 'stripe_not_configured' });
  }

  if (!getOpportunityById) {
    return json(res, 503, { ok: false, error: 'opportunities_unavailable' });
  }

  try {
    const body = parseBody(req);
    const opportunityId = String(body.opportunityId || body.id || '').trim();
    if (!isUuid(opportunityId)) {
      return json(res, 400, { ok: false, error: 'invalid_opportunity_id' });
    }

    const opportunity = await getOpportunityById(opportunityId);
    if (!opportunity) return json(res, 404, { ok: false, error: 'not_found' });
    if (
      !isPlatformAdmin(auth.session) &&
      !opportunityOwnedBySession(auth.session, opportunity)
    ) {
      return json(res, 403, { ok: false, error: 'opportunity_not_owned' });
    }

    if (String(opportunity.status || '').toLowerCase() !== 'published') {
      return json(res, 400, { ok: false, error: 'opportunity_not_live' });
    }
    if (String(opportunity.approvalStatus || opportunity.approval_status || '') !== 'Approved') {
      return json(res, 400, {
        ok: false,
        error: 'opportunity_not_approved',
        message: 'Premium Spotlight is only available after your listing is approved and live.',
      });
    }
    if (!opportunity.listingPaymentActive) {
      return json(res, 400, {
        ok: false,
        error: 'opportunity_not_live',
        message: 'Start your monthly listing subscription before buying Premium Spotlight.',
      });
    }

    if (isNetworkMarketingType(opportunity)) {
      return json(res, 400, {
        ok: false,
        error: 'network_marketing_not_spotlight',
        message:
          'Network marketing listings cannot use Premium Spotlight. Keep a standard listing focused on product sales.',
      });
    }

    try {
      await assertPremiumSpotlightSlotAvailable(opportunityId);
    } catch (slotErr) {
      if (slotErr.code === 'premium_slots_full') {
        const slots = slotErr.slots || {};
        return json(res, 409, {
          ok: false,
          error: 'premium_slots_full',
          message:
            'All ' +
            (slots.max || 12) +
            ' premium spotlight places are currently taken. Your standard listing stays live — try again when a slot opens.',
          premiumSlots: slots,
        });
      }
      throw slotErr;
    }

    const siteUrl = siteBaseUrl();
    const title = encodeURIComponent(opportunity.title || '');
    const checkoutSession = await createOpportunityPremiumCheckoutSession({
      email: auth.session.email,
      opportunityId,
      opportunityTitle: opportunity.title,
      successUrl:
        siteUrl +
        '/organiser/opportunity-premium-success?session_id={CHECKOUT_SESSION_ID}&id=' +
        encodeURIComponent(opportunityId) +
        (title ? '&title=' + title : ''),
      cancelUrl:
        siteUrl +
        '/organiser/opportunity-submitted?id=' +
        encodeURIComponent(opportunityId) +
        (title ? '&title=' + title : '') +
        '&premium=cancelled',
    });

    return json(res, 200, {
      ok: true,
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  } catch (e) {
    return jsonPublicError(res, json, e, { code: 'checkout_failed', logLabel: '[organiser-opportunity-premium-checkout]' });
  }
};
