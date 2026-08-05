#!/usr/bin/env node
/**
 * Stripe Connect destination-charge math smoke test (no live Stripe call).
 *
 * Verifies Tab 9 expectations:
 *   £10 ticket → attendee pays £10.65 → organiser gets £10 → Hub keeps £0.65 fee
 *
 * Usage: node scripts/smoke-test-connect-checkout.js
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env') });

const { calculateCheckoutTotals } = require('../api/_lib/booking-fees');
const { calculatePlatformApplicationFeePence } = require('../api/_lib/stripe-refunds');
const { buildConnectCheckoutParams } = require('../api/_lib/stripe-connect');

function assert(label, condition, detail) {
  if (!condition) {
    const extra = detail != null ? ` (${detail})` : '';
    throw new Error('FAIL: ' + label + extra);
  }
  console.log('  ✓', label);
}

function poundsToPence(amount) {
  return Math.round(Number(amount) * 100);
}

function main() {
  console.log('Connect destination-charge math\n');

  console.log('1. Booking fee on a £10 ticket');
  const totals = calculateCheckoutTotals(10, 1);
  assert('subtotal £10.00', totals.subtotal === 10);
  assert('booking fee £0.65 (4.5% + 20p)', totals.fee === 0.65, totals.fee);
  assert('attendee total £10.65', totals.total === 10.65, totals.total);

  const ticketPence = poundsToPence(totals.subtotal);
  const feePence = poundsToPence(totals.fee);
  assert('ticket subtotal 1000p', ticketPence === 1000);
  assert('booking fee 65p', feePence === 65);

  console.log('\n2. Platform application fee = booking fee only');
  const appFee = calculatePlatformApplicationFeePence(ticketPence, feePence);
  assert('application_fee_amount 65p', appFee === 65, appFee);
  assert('organiser transfer amount implied 1000p', ticketPence === 1000);

  console.log('\n3. buildConnectCheckoutParams shape');
  const readyConnect = {
    ready: true,
    stripeAccountId: 'acct_e2e_test_connect',
    organiserId: 'org_e2e_test',
  };
  const params = buildConnectCheckoutParams({
    connect: readyConnect,
    ticketSubtotalPence: ticketPence,
    bookingFeePence: feePence,
  });
  assert('params returned for ready Connect account', Boolean(params));
  assert(
    'application_fee_amount is booking fee',
    params.paymentIntentData.application_fee_amount === 65,
    params.paymentIntentData.application_fee_amount
  );
  assert(
    'transfer destination is organiser account',
    params.paymentIntentData.transfer_data.destination === 'acct_e2e_test_connect'
  );
  assert(
    'hub_checkout metadata marks destination charge',
    params.paymentIntentData.metadata.hub_checkout === 'connect_destination'
  );
  assert(
    'organiser_id metadata set',
    params.paymentIntentData.metadata.organiser_id === 'org_e2e_test'
  );

  console.log('\n4. Guard rails');
  assert(
    'not ready Connect → null params',
    buildConnectCheckoutParams({
      connect: { ready: false, stripeAccountId: 'acct_x', organiserId: 'org_x' },
      ticketSubtotalPence: ticketPence,
      bookingFeePence: feePence,
    }) === null
  );
  assert(
    'zero fee → null params',
    buildConnectCheckoutParams({
      connect: readyConnect,
      ticketSubtotalPence: ticketPence,
      bookingFeePence: 0,
    }) === null
  );

  console.log('\n5. Multi-qty sanity (£15 × 2)');
  const multi = calculateCheckoutTotals(15, 2);
  // subtotal 30; fee = 30*0.045 + 0.20*2 = 1.35 + 0.40 = 1.75
  assert('2×£15 subtotal £30', multi.subtotal === 30);
  assert('2×£15 fee £1.75', multi.fee === 1.75, multi.fee);
  const multiParams = buildConnectCheckoutParams({
    connect: readyConnect,
    ticketSubtotalPence: poundsToPence(multi.subtotal),
    bookingFeePence: poundsToPence(multi.fee),
  });
  assert(
    'multi-qty application fee 175p',
    multiParams.paymentIntentData.application_fee_amount === 175
  );

  console.log('\n✅ Connect checkout math smoke passed.');
  console.log(
    'Still required for launch: one live Tab 9 purchase in Stripe Dashboard (PIPS-TODO).'
  );
}

try {
  main();
} catch (e) {
  console.error('\n' + (e.message || e));
  process.exit(1);
}
