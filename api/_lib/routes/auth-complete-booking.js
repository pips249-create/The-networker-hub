const { setCors, json, sessionFromRequest } = require('../auth');
const { createRegistrationFromPayment } = require('../supabase-registrations');
const { isSupabaseConfigured } = require('../supabase');
const { verifyEventCheckoutPayment } = require('../verify-checkout-payment');
const { bookingErrorResponse } = require('../booking-error-messages');

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

  if (!session) {
    return json(res, 401, { ok: false, error: 'not_authenticated' });
  }

  try {
    const body = parseBody(req);
    const payment = await verifyEventCheckoutPayment(body, session);

    const email = String(session.email || body.email || '')
      .trim()
      .toLowerCase();
    let name = String(session.name || body.name || '').trim();
    if (!name && email) {
      const local = email.split('@')[0] || '';
      name = local.replace(/[._-]+/g, ' ').trim() || 'Guest';
    }
    if (!name) name = 'Guest';

    if (!email) return json(res, 400, { ok: false, error: 'missing_email' });

    const result = await createRegistrationFromPayment({
      email,
      name,
      userId: session.sub || null,
      eventId: body.eventId || body.event_id || payment.eventId,
      ticketId: body.ticketId || body.ticket_id || payment.ticketId,
      registrationId: body.registrationId || body.registration_id || payment.registrationId,
      quantity: body.quantity ?? body.qty ?? payment.quantity,
      guestNames: body.guestNames || body.guest_names || payment.guestNames,
      dietaryRequirements:
        body.dietaryRequirements || body.dietary_requirements || payment.dietaryRequirements,
      accessibilityRequirements:
        body.accessibilityRequirements ||
        body.accessibility_requirements ||
        payment.accessibilityRequirements,
      amountPaid: payment.amountPaid,
      paymentStatus: payment.paymentStatus,
      stripePaymentIntentId: payment.stripePaymentIntentId,
      stripeCheckoutSessionId: payment.stripeCheckoutSessionId,
      alumniInviteToken:
        body.alumniInviteToken ||
        body.alumni_invite_token ||
        payment.alumniInviteToken ||
        undefined,
    });
    return json(res, 200, { ok: true, ...result });
  } catch (e) {
    const msg = e.message || String(e);
    const mapped = bookingErrorResponse(msg);
    if (mapped) return json(res, mapped.status, mapped.body);
    if (
      msg === 'missing_checkout_session' ||
      msg === 'payment_not_completed' ||
      msg === 'event_mismatch' ||
      msg === 'invalid_checkout_type' ||
      msg === 'ticket_requires_payment' ||
      msg === 'ticket_not_found' ||
      msg === 'ticket_event_mismatch' ||
      msg === 'event_not_found'
    ) {
      return json(res, 400, { ok: false, error: msg });
    }
    if (msg === 'stripe_not_configured') {
      return json(res, 503, { ok: false, error: msg });
    }
    return json(res, 500, { ok: false, error: 'booking_failed', message: msg });
  }
};
