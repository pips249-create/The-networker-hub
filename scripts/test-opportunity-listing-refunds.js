#!/usr/bin/env node
/**
 * Unit checks for opportunity listing Stripe refund detection.
 * Run: node scripts/test-opportunity-listing-refunds.js
 */
const {
  isFullyRefundedCharge,
  isFullyRefundedPaymentIntent,
  isFullyRefundedInvoice,
  listingCheckoutLooksRefunded,
} = require('../api/_lib/opportunity-listing-refunds');

let failed = 0;

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

assert('null charge is not refunded', isFullyRefundedCharge(null) === false);
assert(
  'charge.refunded flag',
  isFullyRefundedCharge({ refunded: true, amount: 3000, amount_refunded: 3000 }) === true
);
assert(
  'full amount_refunded without flag',
  isFullyRefundedCharge({ refunded: false, amount: 3000, amount_refunded: 3000 }) === true
);
assert(
  'partial refund is not full',
  isFullyRefundedCharge({ refunded: false, amount: 3000, amount_refunded: 1000 }) === false
);
assert(
  'unrefunded charge',
  isFullyRefundedCharge({ refunded: false, amount: 3000, amount_refunded: 0 }) === false
);

assert(
  'payment intent latest charge refunded',
  isFullyRefundedPaymentIntent({
    latest_charge: { refunded: true, amount: 3000, amount_refunded: 3000 },
  }) === true
);
assert(
  'payment intent charge id only is not assumed refunded',
  isFullyRefundedPaymentIntent({ latest_charge: 'ch_123' }) === false
);
assert(
  'paid payment intent',
  isFullyRefundedPaymentIntent({
    latest_charge: { refunded: false, amount: 3000, amount_refunded: 0 },
  }) === false
);

assert(
  'invoice credit notes cover amount_paid',
  isFullyRefundedInvoice({ amount_paid: 3000, post_payment_credit_notes_amount: 3000 }) === true
);
assert(
  'invoice expanded charge refunded',
  isFullyRefundedInvoice({
    amount_paid: 3000,
    post_payment_credit_notes_amount: 0,
    charge: { refunded: true, amount: 3000, amount_refunded: 3000 },
  }) === true
);
assert(
  'paid invoice',
  isFullyRefundedInvoice({
    amount_paid: 3000,
    post_payment_credit_notes_amount: 0,
    charge: { refunded: false, amount: 3000, amount_refunded: 0 },
  }) === false
);

assert(
  'complete paid session is not refunded',
  listingCheckoutLooksRefunded({
    status: 'complete',
    payment_status: 'paid',
    payment_intent: {
      latest_charge: { refunded: false, amount: 3000, amount_refunded: 0 },
    },
  }) === false
);
assert(
  'complete session with refunded payment intent is refunded',
  listingCheckoutLooksRefunded({
    status: 'complete',
    payment_status: 'paid',
    payment_intent: {
      latest_charge: { refunded: true, amount: 3000, amount_refunded: 3000 },
    },
  }) === true
);
assert(
  'subscription checkout with refunded invoice is refunded',
  listingCheckoutLooksRefunded({
    status: 'complete',
    payment_status: 'paid',
    invoice: {
      amount_paid: 3000,
      charge: { refunded: true, amount: 3000, amount_refunded: 3000 },
    },
  }) === true
);
assert(
  'subscription latest invoice refunded',
  listingCheckoutLooksRefunded({
    status: 'complete',
    payment_status: 'paid',
    subscription: {
      status: 'active',
      latest_invoice: {
        amount_paid: 3000,
        charge: { refunded: true, amount: 3000, amount_refunded: 3000 },
      },
    },
  }) === true
);

if (failed) {
  console.error(failed + ' test(s) failed');
  process.exit(1);
}
console.log('test-opportunity-listing-refunds: ok');
