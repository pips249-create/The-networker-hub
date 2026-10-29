/**
 * GET|POST /api/organiser/opportunity-listing-invoices
 * Lists paid VAT invoices for a business opportunity listing subscription.
 */
const { getOrganiserApi } = require('../organiser-provider');
const { jsonPublicError } = require('../public-error');
const {
  isStripeCheckoutConfigured,
  getStripeClient,
} = require('../stripe-checkout');
const { listOpportunityListingInvoices } = require('../opportunity-listing-vat-receipt');

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

function opportunityIdFromReq(req) {
  const body = parseBody(req);
  const q = req.query || {};
  return String(
    body.opportunityId || body.id || q.opportunityId || q.id || ''
  ).trim();
}

module.exports = async function handler(req, res) {
  const api = getOrganiserApi();
  const {
    json,
    setCors,
    requireOrganiserSession,
    getOpportunityById,
    opportunityOwnedBySession,
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

  const auth = await requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  if (!isStripeCheckoutConfigured()) {
    return json(res, 503, { ok: false, error: 'stripe_not_configured' });
  }

  if (!getOpportunityById) {
    return json(res, 503, { ok: false, error: 'opportunities_unavailable' });
  }

  try {
    const opportunityId = opportunityIdFromReq(req);
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

    const subscriptionId = String(
      opportunity.listingStripeSubscriptionId ||
        opportunity.listing_stripe_subscription_id ||
        ''
    ).trim();
    if (!subscriptionId) {
      return json(res, 200, {
        ok: true,
        invoices: [],
        message:
          'No Stripe subscription is linked yet. VAT invoices appear here after your first payment.',
      });
    }

    const invoices = await listOpportunityListingInvoices(getStripeClient(), subscriptionId, {
      limit: 36,
    });

    return json(res, 200, {
      ok: true,
      opportunityId,
      subscriptionId,
      invoices,
    });
  } catch (e) {
    return jsonPublicError(res, json, e, {
      code: 'listing_invoices_failed',
      logLabel: '[organiser-opportunity-listing-invoices]',
    });
  }
};
