/**
 * Verify Stripe Checkout sessions before trusting client payment claims.
 */
const { getSupabaseAdmin } = require('./supabase');
const { retrieveCheckoutSession, isStripeCheckoutConfigured } = require('./stripe-checkout');

const NON_EVENT_CHECKOUT_TYPES = new Set([
  'opportunity_listing',
  'opportunity_premium',
  'event_featured',
]);

function checkoutSessionPaid(session) {
  if (!session) return false;
  return (
    session.payment_status === 'paid' ||
    session.payment_status === 'no_payment_required' ||
    session.status === 'complete'
  );
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

async function assertFreeTicketAllowed(input) {
  const sb = getSupabaseAdmin();
  const eventId = String(input.eventId || input.event_id || '').trim();
  const ticketId = String(input.ticketId || input.ticket_id || '').trim();
  if (!eventId) throw new Error('missing_event_id');

  if (ticketId) {
    const ticketRes = await sb
      .from('tickets')
      .select('event_id, price')
      .eq('id', ticketId)
      .maybeSingle();
    if (ticketRes.error) throw new Error(ticketRes.error.message);
    const ticket = ticketRes.data;
    if (!ticket) throw new Error('ticket_not_found');
    if (String(ticket.event_id || '') !== eventId) throw new Error('ticket_event_mismatch');
    const price = Number(ticket.price ?? NaN);
    if (Number.isFinite(price) && price > 0) throw new Error('ticket_requires_payment');
    return;
  }

  const eventRes = await sb.from('events').select('price_key, price_num').eq('id', eventId).maybeSingle();
  if (eventRes.error) throw new Error(eventRes.error.message);
  const event = eventRes.data;
  if (!event) throw new Error('event_not_found');
  const priceKey = String(event.price_key || '').toLowerCase();
  const priceNum = Number(event.price_num ?? 0);
  if (priceKey !== 'free' && priceNum > 0) {
    throw new Error('ticket_requires_payment');
  }
}

/**
 * Resolve trusted payment fields for event ticket bookings.
 * Free bookings skip Stripe; paid bookings require a verified checkout session.
 */
async function verifyEventCheckoutPayment(input, sessionUser) {
  const paymentStatusRaw = String(input.paymentStatus || input.payment_status || '').trim();
  const isFreeClaim =
    paymentStatusRaw === 'Free' ||
    paymentStatusRaw === 'free' ||
    input.amountPaid === 0 ||
    input.amount_paid === 0;

  if (isFreeClaim) {
    await assertFreeTicketAllowed(input);
    return {
      paymentStatus: 'Free',
      amountPaid: 0,
      stripePaymentIntentId: null,
      stripeCheckoutSessionId: null,
    };
  }

  const sessionId = String(
    input.stripeCheckoutSessionId || input.stripe_checkout_session_id || ''
  ).trim();
  if (!sessionId) {
    throw new Error('missing_checkout_session');
  }
  if (!isStripeCheckoutConfigured()) {
    throw new Error('stripe_not_configured');
  }

  const checkout = await retrieveCheckoutSession(sessionId);
  if (!checkoutSessionPaid(checkout)) {
    throw new Error('payment_not_completed');
  }

  const eventId = String(input.eventId || input.event_id || '').trim();
  const metaEventId = String(checkout.metadata?.event_id || '').trim();
  if (metaEventId && eventId && metaEventId !== eventId) {
    throw new Error('event_mismatch');
  }

  const checkoutType = String(checkout.metadata?.checkout_type || '').trim();
  if (checkoutType && NON_EVENT_CHECKOUT_TYPES.has(checkoutType)) {
    throw new Error('invalid_checkout_type');
  }

  const customerEmail = normalizeEmail(checkout.customer_details?.email || checkout.customer_email);
  const userEmail = normalizeEmail(sessionUser?.email);
  if (customerEmail && userEmail && customerEmail !== userEmail) {
    throw new Error('email_mismatch');
  }

  const amountPaid = Number.isFinite(checkout.amount_total) ? checkout.amount_total / 100 : 0;
  const paymentIntent =
    typeof checkout.payment_intent === 'string'
      ? checkout.payment_intent
      : checkout.payment_intent?.id || null;

  return {
    paymentStatus: 'Paid',
    amountPaid,
    stripePaymentIntentId: paymentIntent,
    stripeCheckoutSessionId: sessionId,
  };
}

module.exports = {
  verifyEventCheckoutPayment,
  checkoutSessionPaid,
  assertFreeTicketAllowed,
};
