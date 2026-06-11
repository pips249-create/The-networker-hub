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

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  try {
    const body = parseBody(req);
    const paymentStatus = String(body.paymentStatus || body.payment_status || '').trim();
    const amountRaw = body.amountPaid ?? body.amount_paid;
    const amountPaid = amountRaw != null ? Number(amountRaw) : null;

    const email = String(body.email || session?.email || '')
      .trim()
      .toLowerCase();
    let name = String(body.name || session?.name || '').trim();
    if (!name && email) {
      const local = email.split('@')[0] || '';
      name = local.replace(/[._-]+/g, ' ').trim() || 'Guest';
    }
    if (!name) name = 'Guest';

    if (!email) return json(res, 400, { ok: false, error: 'missing_email' });
    if (!session && paymentStatus !== 'Free') {
      return json(res, 401, { ok: false, error: 'not_authenticated' });
    }

    const result = await createRegistrationFromPayment({
      email,
      name,
      userId: session?.sub || null,
      eventId: body.eventId || body.event_id,
      ticketId: body.ticketId || body.ticket_id,
      quantity: body.quantity ?? body.qty,
      guestNames: body.guestNames || body.guest_names,
      amountPaid: Number.isFinite(amountPaid) ? amountPaid : 0,
      paymentStatus: paymentStatus || (Number.isFinite(amountPaid) && amountPaid > 0 ? 'Paid' : 'Free'),
      stripePaymentIntentId: body.stripePaymentIntentId || body.stripe_payment_intent_id,
      stripeCheckoutSessionId: body.stripeCheckoutSessionId || body.stripe_checkout_session_id,
    });
    return json(res, 200, { ok: true, ...result });
  } catch (e) {
    return json(res, 500, { ok: false, error: 'booking_failed', message: e.message });
  }
};
