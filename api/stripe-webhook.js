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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('method_not_allowed');
  }

  if (!isSupabaseConfigured()) {
    res.statusCode = 503;
    return res.end('supabase_not_configured');
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const rawBody =
    typeof req.body === 'string' ? req.body : req.body ? JSON.stringify(req.body) : '';

  if (webhookSecret) {
    const sig = req.headers['stripe-signature'];
    if (!verifyStripeSignature(rawBody, sig, webhookSecret)) {
      res.statusCode = 400;
      return res.end('invalid_signature');
    }
  }

  const event = parseStripeEventBody(req);
  if (!event || !event.type) {
    res.statusCode = 400;
    return res.end('invalid_payload');
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const result = await handleCheckoutSessionCompleted(event.data.object || {});
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, result }));
    }

    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, ignored: event.type }));
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: e.message || String(e) }));
  }
};
