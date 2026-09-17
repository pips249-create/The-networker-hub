#!/usr/bin/env node
/**
 * Smoke tests for Connected booking subscription helpers (no Stripe/Supabase).
 */
const assert = require('assert');
const {
  isConnectedBookingMetadata,
  CONNECTED_BOOKING_CHECKOUT_TYPE,
} = require('../api/_lib/connected-booking-subscriptions');
const {
  connectedBookingPlanTotals,
  isSelfServeConnectedPlan,
} = require('../api/_lib/connected-booking-pricing');

assert.strictEqual(CONNECTED_BOOKING_CHECKOUT_TYPE, 'connected_booking');
assert.strictEqual(isConnectedBookingMetadata({ checkout_type: 'connected_booking' }), true);
assert.strictEqual(isConnectedBookingMetadata({ checkout_type: 'other' }), false);

assert.strictEqual(isSelfServeConnectedPlan('starter'), true);
assert.strictEqual(isSelfServeConnectedPlan('enterprise'), false);

const starter = connectedBookingPlanTotals('starter');
assert.strictEqual(starter.monthlyExVatPence, 3900);
assert.strictEqual(starter.monthlyVatPence, 780);
assert.strictEqual(starter.totalPence, 4680);

console.log('test-connected-booking-subscriptions: ok');
