/**
 * Stripe webhook — creates registrations after checkout.session.completed.
 * Set STRIPE_WEBHOOK_SECRET in env. Payment links must include metadata:
 *   event_id (required), ticket_id (optional)
 *
 * Stripe signs the exact raw request bytes. Never JSON.parse + JSON.stringify
 * the body before verifying — that changes whitespace and fails every delivery.
 */
const Stripe = require('stripe');
const {
  handleCheckoutSessionCompleted,
  parseStripeEventBody,
} = require('./_lib/supabase-registrations');
const { wrapHandler, captureServerException } = require('./_lib/sentry');
const { isSupabaseConfigured } = require('./_lib/supabase');
const { handleOpportunityPremiumCheckout, handleOpportunityListingCheckout } = require('./_lib/supabase-opportunities');
const { handleEventFeaturedCheckout } = require('./_lib/event-featured');
const { handleGroupUpdateCreditsCheckout } = require('./_lib/group-update-credits');
const { handleConnectionsCreditsCheckout } = require('./_lib/connections-credits');
const { handleChargeRefunded } = require('./_lib/stripe-refund-webhook');
const { handleInvoicePaid, handleSponsorshipCheckoutCompleted } = require('./_lib/stripe-revenue');
const {
  handleCityPartnerCheckoutCompleted,
  handleCityPartnerSubscriptionUpdated,
  handleCityPartnerSubscriptionDeleted,
} = require('./_lib/city-partner-subscriptions');
const {
  handleCountyPartnerCheckoutCompleted,
  handleCountyPartnerSubscriptionUpdated,
  handleCountyPartnerSubscriptionDeleted,
} = require('./_lib/county-partner-subscriptions');
const {
  handleOpportunityListingSubscriptionUpdated,
  handleOpportunityListingSubscriptionDeleted,
  handleOpportunityListingInvoicePaid,
} = require('./_lib/opportunity-listing-subscriptions');
const {
  handleMembershipCheckoutCompleted,
  handleMembershipSubscriptionUpdated,
  handleMembershipSubscriptionDeleted,
  handleMembershipInvoicePaid,
  handleMembershipInvoicePaymentFailed,
} = require('./_lib/membership-billing');

const STRIPE_WEBHOOK_TOLERANCE_SEC = 300;

/**
 * Read the exact bytes Stripe signed. Do not re-serialize parsed JSON.
 */
function readRawBody(req) {
  return new Promise(function (resolve, reject) {
    if (typeof req.rawBody === 'string') {
      resolve(req.rawBody);
      return;
    }
    if (Buffer.isBuffer(req.rawBody)) {
      resolve(req.rawBody.toString('utf8'));
      return;
    }
    if (typeof req.body === 'string') {
      resolve(req.body);
      return;
    }
    if (Buffer.isBuffer(req.body)) {
      resolve(req.body.toString('utf8'));
      return;
    }
    // Parsed object means bodyParser ran — original signed bytes are gone.
    if (req.body && typeof req.body === 'object') {
      const err = new Error('parsed_body_not_raw');
      err.code = 'parsed_body_not_raw';
      reject(err);
      return;
    }

    const chunks = [];
    req.on('data', function (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', function () {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

function verifyAndParseStripeEvent(rawBody, signatureHeader, secret) {
  try {
    return Stripe.webhooks.constructEvent(
      rawBody,
      signatureHeader,
      secret,
      STRIPE_WEBHOOK_TOLERANCE_SEC
    );
  } catch (err) {
    const e = new Error(err && err.message ? err.message : 'invalid_signature');
    e.code = 'invalid_signature';
    throw e;
  }
}

async function runHandler(label, fn) {
  try {
    return await fn();
  } catch (err) {
    console.error('[stripe-webhook]', label, err && err.message ? err.message : err);
    captureServerException(err, { route: '/api/stripe-webhook', logLabel: label });
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('method_not_allowed');
  }

  if (!isSupabaseConfigured()) {
    res.statusCode = 503;
    return res.end('supabase_not_configured');
  }

  const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  const skipVerify =
    process.env.STRIPE_WEBHOOK_SKIP_VERIFY === '1' ||
    process.env.STRIPE_WEBHOOK_SKIP_VERIFY === 'local-dev';
  if (!webhookSecret) {
    // Fail closed on every deployed environment; local only with explicit skip flag.
    if (process.env.VERCEL_ENV || process.env.NODE_ENV === 'production' || !skipVerify) {
      res.statusCode = 503;
      return res.end('webhook_secret_not_configured');
    }
  }

  let rawBody = '';
  try {
    rawBody = await readRawBody(req);
  } catch (e) {
    if (e && e.code === 'parsed_body_not_raw') {
      res.statusCode = 500;
      return res.end('raw_body_unavailable');
    }
    res.statusCode = 400;
    return res.end('invalid_body');
  }

  let event = null;
  if (webhookSecret) {
    const sig = req.headers['stripe-signature'];
    try {
      event = verifyAndParseStripeEvent(rawBody, sig, webhookSecret);
    } catch {
      res.statusCode = 400;
      return res.end('invalid_signature');
    }
  } else if (!skipVerify) {
    res.statusCode = 503;
    return res.end('webhook_secret_not_configured');
  } else {
    event = parseStripeEventBody(rawBody);
  }

  if (!event || !event.type) {
    res.statusCode = 400;
    return res.end('invalid_payload');
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object || {};
      const sponsorshipResult = await runHandler('sponsorship', () =>
        handleSponsorshipCheckoutCompleted(session)
      );
      const cityPartnerResult = await runHandler('city_partner', () =>
        handleCityPartnerCheckoutCompleted(session)
      );
      const countyPartnerResult = await runHandler('county_partner', () =>
        handleCountyPartnerCheckoutCompleted(session)
      );
      const membershipResult = await runHandler('membership', () =>
        handleMembershipCheckoutCompleted(session)
      );
      const premiumResult = await runHandler('opportunity_premium', () =>
        handleOpportunityPremiumCheckout(session)
      );
      const listingResult = await runHandler('opportunity_listing', () =>
        handleOpportunityListingCheckout(session)
      );
      const featuredResult = await runHandler('event_featured', () =>
        handleEventFeaturedCheckout(session)
      );
      const groupUpdateCreditsResult = await runHandler('group_update_credits', () =>
        handleGroupUpdateCreditsCheckout(session)
      );
      const connectionsCreditsResult = await runHandler('connections_credits', () =>
        handleConnectionsCreditsCheckout(session)
      );
      const registrationResult = await runHandler('registration', () =>
        handleCheckoutSessionCompleted(session)
      );
      res.statusCode = 200;
      return res.end(
        JSON.stringify({
          ok: true,
          sponsorshipResult,
          cityPartnerResult,
          countyPartnerResult,
          membershipResult,
          premiumResult,
          listingResult,
          featuredResult,
          groupUpdateCreditsResult,
          connectionsCreditsResult,
          registrationResult,
        })
      );
    }

    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object || {};
      const cityPartnerResult = await runHandler('city_partner_sub_updated', () =>
        handleCityPartnerSubscriptionUpdated(subscription)
      );
      const countyPartnerResult = await runHandler('county_partner_sub_updated', () =>
        handleCountyPartnerSubscriptionUpdated(subscription)
      );
      const membershipResult = await runHandler('membership_sub_updated', () =>
        handleMembershipSubscriptionUpdated(subscription)
      );
      const listingResult = await runHandler('listing_sub_updated', () =>
        handleOpportunityListingSubscriptionUpdated(subscription)
      );
      res.statusCode = 200;
      return res.end(
        JSON.stringify({ ok: true, cityPartnerResult, countyPartnerResult, membershipResult, listingResult })
      );
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object || {};
      const cityPartnerResult = await runHandler('city_partner_sub_deleted', () =>
        handleCityPartnerSubscriptionDeleted(subscription)
      );
      const countyPartnerResult = await runHandler('county_partner_sub_deleted', () =>
        handleCountyPartnerSubscriptionDeleted(subscription)
      );
      const membershipResult = await runHandler('membership_sub_deleted', () =>
        handleMembershipSubscriptionDeleted(subscription)
      );
      const listingResult = await runHandler('listing_sub_deleted', () =>
        handleOpportunityListingSubscriptionDeleted(subscription)
      );
      res.statusCode = 200;
      return res.end(
        JSON.stringify({ ok: true, cityPartnerResult, countyPartnerResult, membershipResult, listingResult })
      );
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object || {};
      const revenueResult = await runHandler('invoice_revenue', () => handleInvoicePaid(invoice));
      const membershipResult = await runHandler('membership_invoice_paid', () =>
        handleMembershipInvoicePaid(invoice)
      );
      const listingResult = await runHandler('listing_invoice_paid', () =>
        handleOpportunityListingInvoicePaid(invoice)
      );
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, revenueResult, membershipResult, listingResult }));
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object || {};
      const membershipResult = await runHandler('membership_invoice_failed', () =>
        handleMembershipInvoicePaymentFailed(invoice)
      );
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, membershipResult }));
    }

    if (event.type === 'charge.refunded') {
      const charge = event.data.object || {};
      const refundResult = await runHandler('charge_refunded', () => handleChargeRefunded(charge));
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, refundResult }));
    }

    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ignored: event.type }));
  } catch (e) {
    captureServerException(e, { route: '/api/stripe-webhook', logLabel: 'unhandled' });
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: e.message || String(e) }));
  }
}

const wrapped = wrapHandler(handler);
wrapped.config = {
  api: {
    bodyParser: false,
  },
};
module.exports = wrapped;
