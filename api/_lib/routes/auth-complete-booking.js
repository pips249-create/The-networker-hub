const { setCors, json, sessionFromRequest } = require('../auth');
const { createRegistrationFromPayment } = require('../supabase-registrations');
const { isSupabaseConfigured } = require('../supabase');

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

/** Authenticated fallback when checkout success page confirms payment before webhook arrives. */
module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const session = sessionFromRequest(req);
  if (!session) return json(res, 401, { error: 'not_authenticated' });

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  try {
    const body = parseBody(req);
    const result = await createRegistrationFromPayment({
      email: session.email,
      name: session.name,
      userId: session.sub,
      eventId: body.eventId || body.event_id,
      ticketId: body.ticketId || body.ticket_id,
      quantity: body.quantity ?? body.qty,
      amountPaid: body.amountPaid ?? body.amount_paid,
      paymentStatus: body.paymentStatus || body.payment_status || 'Paid',
      stripePaymentIntentId: body.stripePaymentIntentId || body.stripe_payment_intent_id,
      stripeCheckoutSessionId: body.stripeCheckoutSessionId || body.stripe_checkout_session_id,
    });
    return json(res, 200, { ok: true, ...result });
  } catch (e) {
    return json(res, 500, { ok: false, error: 'booking_failed', message: e.message });
  }
};
