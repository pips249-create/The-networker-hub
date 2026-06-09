const { getOrganiserApi } = require('../organiser-provider');
const {
  isStripeCheckoutConfigured,
  retrieveCheckoutSession,
} = require('../stripe-checkout');

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

/** Fallback when Stripe webhook is delayed — confirm premium checkout and activate listing. */
module.exports = async function handler(req, res) {
  const api = getOrganiserApi();
  const {
    json,
    setCors,
    requireOrganiserSession,
    getOpportunityById,
    opportunityOwnedBySession,
    isPlatformAdmin,
    handleOpportunityPremiumCheckout,
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

  if (!handleOpportunityPremiumCheckout) {
    return json(res, 503, { ok: false, error: 'opportunities_unavailable' });
  }

  try {
    const body = parseBody(req);
    const sessionId = String(body.sessionId || body.session_id || '').trim();
    if (!sessionId) return json(res, 400, { ok: false, error: 'missing_session_id' });

    const session = await retrieveCheckoutSession(sessionId);
    const opportunityId = String(session?.metadata?.opportunity_id || '').trim();
    if (!isUuid(opportunityId)) {
      return json(res, 400, { ok: false, error: 'invalid_checkout_session' });
    }

    const opportunity = await getOpportunityById(opportunityId);
    if (!opportunity) return json(res, 404, { ok: false, error: 'not_found' });
    if (
      !isPlatformAdmin(auth.session) &&
      !opportunityOwnedBySession(auth.session, opportunity)
    ) {
      return json(res, 403, { ok: false, error: 'opportunity_not_owned' });
    }

    const result = await handleOpportunityPremiumCheckout(session);
    return json(res, 200, { ok: true, result, opportunity });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: 'premium_complete_failed',
      message: e.message || String(e),
    });
  }
};
