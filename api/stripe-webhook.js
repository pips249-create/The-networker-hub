/**
 * Stripe webhook — creates registrations after checkout.session.completed.
 * Set STRIPE_WEBHOOK_SECRET in env. Payment links must include metadata:
 *   event_id (required), ticket_id (optional)
 */
const crypto = require('crypto');
const {
  handleCheckoutSessionCompleted,
  parseStripeEventBody,
} = require('./_lib/supabase-registrations');
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

function verifyStripeSignature(rawBody, signatureHeader, secret, toleranceSec = STRIPE_WEBHOOK_TOLERANCE_SEC) {
  if (!signatureHeader || !secret) return false;
  const parts = String(signatureHeader).split(',');
  let timestamp = '';
  const signatures = [];
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k === 't') timestamp = v;
    if (k === 'v1' && v) signatures.push(v);
  }
  if (!timestamp || !signatures.length) return false;

  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return false;
  const ageSec = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (ageSec > toleranceSec) return false;

  const payload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  for (const signature of signatures) {
    try {
      const sigBuf = Buffer.from(signature, 'hex');
      if (sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        return true;
      }
    } catch {
      /* try next v1 */
    }
  }
  return false;
}

function readRawBody(req) {
  return new Promise(function (resolve, reject) {
    if (typeof req.body === 'string') {
      resolve(req.body);
      return;
    }
    if (Buffer.isBuffer(req.body)) {
      resolve(req.body.toString('utf8'));
      return;
    }
    if (req.body && typeof req.body === 'object') {
      resolve(JSON.stringify(req.body));
      return;
    }

    const chunks = [];
    req.on('data', function (chunk) {
      chunks.push(chunk);
    });
    req.on('end', function () {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
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

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
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
    res.statusCode = 400;
    return res.end('invalid_body');
  }

  if (webhookSecret) {
    const sig = req.headers['stripe-signature'];
    if (!verifyStripeSignature(rawBody, sig, webhookSecret)) {
      res.statusCode = 400;
      return res.end('invalid_signature');
    }
  } else if (!skipVerify) {
    res.statusCode = 503;
    return res.end('webhook_secret_not_configured');
  }

  const event = parseStripeEventBody(rawBody);
  if (!event || !event.type) {
    res.statusCode = 400;
    return res.end('invalid_payload');
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object || {};
      const sponsorshipResult = await handleSponsorshipCheckoutCompleted(session);
      const cityPartnerResult = await handleCityPartnerCheckoutCompleted(session);
      const membershipResult = await handleMembershipCheckoutCompleted(session);
      const premiumResult = await handleOpportunityPremiumCheckout(session);
      const listingResult = await handleOpportunityListingCheckout(session);
      const featuredResult = await handleEventFeaturedCheckout(session);
      const groupUpdateCreditsResult = await handleGroupUpdateCreditsCheckout(session);
      const connectionsCreditsResult = await handleConnectionsCreditsCheckout(session);
      const registrationResult = await handleCheckoutSessionCompleted(session);
      res.statusCode = 200;
      return res.end(
        JSON.stringify({
          ok: true,
          sponsorshipResult,
          cityPartnerResult,
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
      const cityPartnerResult = await handleCityPartnerSubscriptionUpdated(subscription);
      const membershipResult = await handleMembershipSubscriptionUpdated(subscription);
      const listingResult = await handleOpportunityListingSubscriptionUpdated(subscription);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, cityPartnerResult, membershipResult, listingResult }));
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object || {};
      const cityPartnerResult = await handleCityPartnerSubscriptionDeleted(subscription);
      const membershipResult = await handleMembershipSubscriptionDeleted(subscription);
      const listingResult = await handleOpportunityListingSubscriptionDeleted(subscription);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, cityPartnerResult, membershipResult, listingResult }));
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object || {};
      const revenueResult = await handleInvoicePaid(invoice);
      const membershipResult = await handleMembershipInvoicePaid(invoice);
      const listingResult = await handleOpportunityListingInvoicePaid(invoice);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, revenueResult, membershipResult, listingResult }));
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object || {};
      const membershipResult = await handleMembershipInvoicePaymentFailed(invoice);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, membershipResult }));
    }

    if (event.type === 'charge.refunded') {
      const charge = event.data.object || {};
      const refundResult = await handleChargeRefunded(charge);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, refundResult }));
    }

    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ignored: event.type }));
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: e.message || String(e) }));
  }
}

module.exports = handler;
module.exports.config = {
  api: {
    bodyParser: false,
  },
};
