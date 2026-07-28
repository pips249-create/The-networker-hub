const { getOrganiserApi } = require('../organiser-provider');
const {
  isStripeCheckoutConfigured,
  createOpportunityListingCheckoutSession,
  siteBaseUrl,
} = require('../stripe-checkout');
const { normalizeListingMonths, calculateOpportunityListingTotals } = require('../opportunity-listing-pricing');
const { validateFcaDisclaimer } = require('../opportunity-moderation');

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

/** Start Stripe Checkout for a prepaid opportunity listing (£25/month ex VAT, min 3 months). */
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

  const auth = requireOrganiserSession(req);
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
    const months = normalizeListingMonths(body.months);
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

    const fcaAttestation = validateFcaDisclaimer({
      type: opportunity.type,
      types: opportunity.types,
      meta: opportunity.meta,
      fcaDisclaimerAttested: Boolean(body.fcaDisclaimerAttested),
    });
    if (fcaAttestation) {
      return json(res, 400, {
        ok: false,
        error: fcaAttestation.code,
        message: fcaAttestation.message,
      });
    }

    const siteUrl = siteBaseUrl();
    const title = encodeURIComponent(opportunity.title || '');
    const totals = calculateOpportunityListingTotals(months);
    const checkoutSession = await createOpportunityListingCheckoutSession({
      email: auth.session.email,
      opportunityId,
      months,
      opportunityTitle: opportunity.title,
      successUrl:
        siteUrl +
        '/organiser/opportunity-listing-success?session_id={CHECKOUT_SESSION_ID}&id=' +
        encodeURIComponent(opportunityId) +
        (title ? '&title=' + title : '') +
        '&months=' +
        encodeURIComponent(String(months)),
      cancelUrl:
        siteUrl +
        '/organiser/opportunity-edit?id=' +
        encodeURIComponent(opportunityId) +
        '&checkout=cancelled',
    });

    return json(res, 200, {
      ok: true,
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
      months: totals.months,
      subtotalExVatPence: totals.subtotalExVatPence,
      vatPence: totals.vatPence,
      totalPence: totals.totalPence,
    });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: 'checkout_failed',
      message: e.message || String(e),
    });
  }
};
