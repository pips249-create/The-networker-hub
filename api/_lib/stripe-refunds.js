/**
 * Stripe refund verification and issuance — organiser event cancellation.
 */
const { getStripeClient, isStripeCheckoutConfigured } = require('./stripe-checkout');
const { getSupabaseAdmin } = require('./supabase');

const PLATFORM_FEE_RATE = 0.03;

function isStripeRefundsConfigured() {
  return isStripeCheckoutConfigured();
}

function isDestinationConnectCharge(paymentIntent) {
  const hubCheckout = String(paymentIntent?.metadata?.hub_checkout || '').trim();
  if (hubCheckout === 'connect_destination') return true;
  if (hubCheckout === 'connect_direct') return false;
  return Boolean(paymentIntent?.transfer_data?.destination);
}

async function resolveConnectStripeAccount(registration) {
  const organiserId = String(registration?.organiser_id || '').trim();
  if (!organiserId) return null;
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('organisers')
    .select('stripe_account_id')
    .eq('id', organiserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return String(data?.stripe_account_id || '').trim() || null;
}

async function retrieveConnectPaymentIntent(paymentIntentId, registration) {
  const stripe = getStripeClient();
  const id = String(paymentIntentId || '').trim();
  const stripeAccountId = await resolveConnectStripeAccount(registration);

  if (stripeAccountId) {
    try {
      const directPi = await stripe.paymentIntents.retrieve(id, { stripeAccount: stripeAccountId });
      if (directPi?.id) return { paymentIntent: directPi, stripeAccountId };
    } catch {
      /* fall back to platform lookup for legacy destination charges */
    }
  }

  const platformPi = await stripe.paymentIntents.retrieve(id);
  return { paymentIntent: platformPi, stripeAccountId: null };
}

async function retrievePaymentIntentRefundState(paymentIntentId, registration = null) {
  if (!paymentIntentId || !isStripeRefundsConfigured()) {
    return { checked: false, refunded: false, amountRefunded: 0, amountPaid: 0 };
  }

  const { paymentIntent: pi, stripeAccountId } = await retrieveConnectPaymentIntent(
    paymentIntentId,
    registration
  );
  const stripe = getStripeClient();
  const requestOpts = stripeAccountId ? { stripeAccount: stripeAccountId } : undefined;
  const amountPaid = Number(pi.amount_received || pi.amount || 0);
  let amountRefunded = 0;
  let refunded = pi.status === 'canceled';

  const chargeId =
    typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id || null;

  if (chargeId) {
    const charge = await stripe.charges.retrieve(chargeId, requestOpts);
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
    hubCheckout: pi.metadata?.hub_checkout || null,
    stripeAccountId,
    destinationCharge: isDestinationConnectCharge(pi),
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

  const state = await retrievePaymentIntentRefundState(paymentIntentId, registration);
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

/** Hub keeps the booking fee only; organiser receives the full ticket subtotal on their Connect account. */
function calculatePlatformApplicationFeePence(_ticketSubtotalPence, bookingFeePence) {
  return Math.max(0, Math.round(Number(bookingFeePence) || 0));
}

/**
 * Issue a full Stripe refund for one paid registration (idempotent if already refunded).
 */
async function issueRefundForRegistration(registration, options = {}) {
  const paymentIntentId = String(registration?.stripe_payment_intent_id || '').trim();
  if (!paymentIntentId) {
    return {
      registrationId: registration?.id,
      required: false,
      issued: true,
      skipped: true,
      reason: 'no_payment_intent',
    };
  }

  const state = await retrievePaymentIntentRefundState(paymentIntentId, registration);
  if (state.refunded) {
    return {
      registrationId: registration.id,
      required: true,
      issued: true,
      skipped: true,
      reason: 'already_refunded',
      paymentIntentId,
    };
  }

  if (!isStripeRefundsConfigured()) {
    return {
      registrationId: registration.id,
      required: true,
      issued: false,
      error: 'Stripe is not configured',
      code: 'stripe_not_configured',
      paymentIntentId,
    };
  }

  const stripe = getStripeClient();
  const connectEnabled =
    options.connectEnabled != null
      ? Boolean(options.connectEnabled)
      : (() => {
          try {
            const { isStripeConnectEnabled } = require('./stripe-connect');
            return isStripeConnectEnabled();
          } catch {
            return false;
          }
        })();

  const { paymentIntent, stripeAccountId } = await retrieveConnectPaymentIntent(
    paymentIntentId,
    registration
  );
  const destinationCharge = isDestinationConnectCharge(paymentIntent);
  const directCharge =
    connectEnabled &&
    !destinationCharge &&
    Boolean(stripeAccountId || String(paymentIntent?.metadata?.hub_checkout || '') === 'connect_direct');

  const params = { payment_intent: paymentIntentId };
  const requestOpts = directCharge && stripeAccountId ? { stripeAccount: stripeAccountId } : undefined;
  if (connectEnabled) {
    params.refund_application_fee = true;
    if (destinationCharge) params.reverse_transfer = true;
  }

  try {
    const refund = await stripe.refunds.create(params, requestOpts);
    return {
      registrationId: registration.id,
      required: true,
      issued: true,
      skipped: false,
      refundId: refund.id,
      status: refund.status,
      amount: refund.amount,
      paymentIntentId,
    };
  } catch (err) {
    return {
      registrationId: registration.id,
      required: true,
      issued: false,
      error: err.message || String(err),
      code: err.code || 'refund_failed',
      paymentIntentId,
    };
  }
}

/**
 * Issue full refunds for every paid registration on an event.
 */
async function issueEventRefundsInStripe(registrations, options = {}) {
  const paid = (registrations || []).filter(
    (row) => String(row.payment_status || '').trim() === 'Paid'
  );

  if (!paid.length) {
    return {
      allIssued: true,
      totalPaid: 0,
      issued: [],
      failed: [],
      skipped: [],
    };
  }

  const results = await Promise.all(paid.map((row) => issueRefundForRegistration(row, options)));
  const failed = results.filter((row) => row.required && !row.issued);
  const issued = results.filter((row) => row.issued && !row.skipped);
  const skipped = results.filter((row) => row.skipped);

  return {
    allIssued: failed.length === 0,
    totalPaid: paid.length,
    issued,
    failed,
    skipped,
    results,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll Stripe until refunds show as completed, or attempts are exhausted.
 */
async function waitForEventRefundsInStripe(registrations, options = {}) {
  const attempts = Math.max(1, Number(options.attempts) || 5);
  const delayMs = Math.max(0, Number(options.delayMs) || 1500);
  let last = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) await sleep(delayMs);
    last = await verifyEventRefundsInStripe(registrations);
    if (last.allRefunded) return last;
  }

  return last;
}

module.exports = {
  PLATFORM_FEE_RATE,
  isStripeRefundsConfigured,
  retrievePaymentIntentRefundState,
  verifyRegistrationRefunded,
  verifyEventRefundsInStripe,
  waitForEventRefundsInStripe,
  issueRefundForRegistration,
  issueEventRefundsInStripe,
  calculatePlatformApplicationFeePence,
};
