/**
 * POST /api/organiser/opportunity-listing-portal
 * Opens Stripe Customer Portal so listing owners can cancel or update billing
 * (UK DMCC easy-exit — cancel should be as easy as subscribe).
 */
const { getOrganiserApi } = require('../organiser-provider');
const { jsonPublicError } = require('../public-error');
const {
  isStripeCheckoutConfigured,
  createMembershipBillingPortalSession,
  siteBaseUrl,
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

    const { resolveListingBillingCustomer } = require('../opportunity-listing-subscriptions');
    const billing = await resolveListingBillingCustomer(opportunity);
    const customerId = billing && billing.customerId;
    const subscription = billing && billing.subscription;
    if (!customerId) {
      return json(res, 404, {
        ok: false,
        error: 'no_listing_subscription',
        message:
          'No active Stripe subscription found for this listing. If you were charged recently, email hi@thenetworkeruk.com and we will help you cancel.',
      });
    }

    const returnUrl =
      String(body.returnUrl || body.return_url || '').trim() ||
      siteBaseUrl() + '/organiser/opportunity-edit?id=' + encodeURIComponent(opportunityId);

    const portal = await createMembershipBillingPortalSession({
      customerId,
      returnUrl,
    });

    return json(res, 200, {
      ok: true,
      url: portal.url,
      subscriptionStatus: subscription
        ? String(subscription.status || '').toLowerCase() || null
        : null,
      cancelAtPeriodEnd: Boolean(subscription && subscription.cancel_at_period_end),
    });
  } catch (e) {
    return jsonPublicError(res, json, e, {
      code: 'listing_portal_failed',
      logLabel: '[organiser-opportunity-listing-portal]',
    });
  }
};
