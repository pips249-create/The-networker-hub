/**
 * Stripe refund verification — used before confirming organiser refunds or sending emails.
 */
const { getStripeClient, isStripeCheckoutConfigured } = require('./stripe-checkout');

const PLATFORM_FEE_RATE = 0.03;

function isStripeRefundsConfigured() {
  return isStripeCheckoutConfigured();
}

async function retrievePaymentIntentRefundState(paymentIntentId) {
  if (!paymentIntentId || !isStripeRefundsConfigured()) {
    return { checked: false, refunded: false, amountRefunded: 0, amountPaid: 0 };
  }

  const stripe = getStripeClient();
  const pi = await stripe.paymentIntents.retrieve(String(paymentIntentId));
  const amountPaid = Number(pi.amount_received || pi.amount || 0);
  let amountRefunded = 0;
  let refunded = pi.status === 'canceled';

  const chargeId =
    typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id || null;

  if (chargeId) {
    const charge = await stripe.charges.retrieve(chargeId);
    amountRefunded = Number(charge.amount_refunded || 0);
    if (charge.refunded || (amountPaid > 0 && amountRefunded >= amountPaid)) {
      refunded = true;
    }
  }

  return {
    checked: true,
    refunded,
    amountRefunded,
    amountPaid,
    paymentIntentId: String(paymentIntentId),
  };
}

async function verifyRegistrationRefunded(registration) {
  const paymentIntentId = String(registration?.stripe_payment_intent_id || '').trim();
  if (!paymentIntentId) {
    return {
      registrationId: registration?.id,
      required: false,
      refunded: true,
      reason: 'no_payment_intent',
    };
  }

  const state = await retrievePaymentIntentRefundState(paymentIntentId);
  return {
    registrationId: registration.id,
    required: true,
    refunded: state.refunded,
    amountRefunded: state.amountRefunded,
    amountPaid: state.amountPaid,
    paymentIntentId,
  };
}

/**
 * Verify all paid registrations for an event are refunded in Stripe.
 */
async function verifyEventRefundsInStripe(registrations) {
  const paid = (registrations || []).filter(
    (row) => String(row.payment_status || '').trim() === 'Paid'
  );

  if (!paid.length) {
    return {
      allRefunded: true,
      totalPaid: 0,
      verified: [],
      pending: [],
      skipped: paid.length,
    };
  }

  if (!isStripeRefundsConfigured()) {
    const err = new Error('Stripe is not configured — cannot verify refunds');
    err.status = 503;
    err.code = 'stripe_not_configured';
    throw err;
  }

  const results = await Promise.all(paid.map((row) => verifyRegistrationRefunded(row)));
  const pending = results.filter((r) => r.required && !r.refunded);
  const verified = results.filter((r) => r.refunded);

  return {
    allRefunded: pending.length === 0,
    totalPaid: paid.length,
    verified,
    pending,
  };
}

function calculatePlatformApplicationFeePence(ticketSubtotalPence, bookingFeePence) {
  const ticket = Math.max(0, Number(ticketSubtotalPence) || 0);
  const fee = Math.max(0, Number(bookingFeePence) || 0);
  const platformOnTicket = Math.round(ticket * PLATFORM_FEE_RATE);
  return platformOnTicket + fee;
}

module.exports = {
  PLATFORM_FEE_RATE,
  isStripeRefundsConfigured,
  retrievePaymentIntentRefundState,
  verifyRegistrationRefunded,
  verifyEventRefundsInStripe,
  calculatePlatformApplicationFeePence,
};
