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
const { handleChargeRefunded } = require('./_lib/stripe-refund-webhook');

function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  const parts = String(signatureHeader)
    .split(',')
    .reduce((acc, part) => {
      const [k, v] = part.split('=');
      if (k && v) acc[k.trim()] = v.trim();
      return acc;
    }, {});
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const payload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
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
  }

  const event = parseStripeEventBody(rawBody);
  if (!event || !event.type) {
    res.statusCode = 400;
    return res.end('invalid_payload');
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object || {};
      const premiumResult = await handleOpportunityPremiumCheckout(session);
      const listingResult = await handleOpportunityListingCheckout(session);
      const featuredResult = await handleEventFeaturedCheckout(session);
      const registrationResult = await handleCheckoutSessionCompleted(session);
      res.statusCode = 200;
      return res.end(
        JSON.stringify({ ok: true, premiumResult, listingResult, featuredResult, registrationResult })
      );
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
