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
const {
  connectedBookingFreeEnabled,
  connectedBookingFreeDefaultPlan,
  linkOutFreeEnabled,
  PLAN_GROUP_LIMITS,
} = require('../api/_lib/connected-booking-util');

assert.strictEqual(CONNECTED_BOOKING_CHECKOUT_TYPE, 'connected_booking');
assert.strictEqual(isConnectedBookingMetadata({ checkout_type: 'connected_booking' }), true);
assert.strictEqual(isConnectedBookingMetadata({ checkout_type: 'other' }), false);

assert.strictEqual(isSelfServeConnectedPlan('starter'), true);
assert.strictEqual(isSelfServeConnectedPlan('enterprise'), false);

const prevRequire = process.env.CONNECTED_BOOKING_REQUIRE_SUBSCRIPTION;
const prevFreePlan = process.env.CONNECTED_BOOKING_FREE_PLAN;
delete process.env.CONNECTED_BOOKING_REQUIRE_SUBSCRIPTION;
assert.strictEqual(connectedBookingFreeEnabled(), true);
assert.strictEqual(connectedBookingFreeDefaultPlan(), 'enterprise');
assert.strictEqual(PLAN_GROUP_LIMITS.enterprise, null);
const prevLinkOut = process.env.LINK_OUT_REQUIRE_PAYMENT;
delete process.env.LINK_OUT_REQUIRE_PAYMENT;
assert.strictEqual(linkOutFreeEnabled(), true);
process.env.LINK_OUT_REQUIRE_PAYMENT = 'true';
assert.strictEqual(linkOutFreeEnabled(), false);
process.env.CONNECTED_BOOKING_REQUIRE_SUBSCRIPTION = 'true';
assert.strictEqual(connectedBookingFreeEnabled(), false);
process.env.CONNECTED_BOOKING_FREE_PLAN = 'scale';
delete process.env.CONNECTED_BOOKING_REQUIRE_SUBSCRIPTION;
assert.strictEqual(connectedBookingFreeDefaultPlan(), 'scale');
if (prevRequire == null) delete process.env.CONNECTED_BOOKING_REQUIRE_SUBSCRIPTION;
else process.env.CONNECTED_BOOKING_REQUIRE_SUBSCRIPTION = prevRequire;
if (prevFreePlan == null) delete process.env.CONNECTED_BOOKING_FREE_PLAN;
else process.env.CONNECTED_BOOKING_FREE_PLAN = prevFreePlan;
if (prevLinkOut == null) delete process.env.LINK_OUT_REQUIRE_PAYMENT;
else process.env.LINK_OUT_REQUIRE_PAYMENT = prevLinkOut;

const starter = connectedBookingPlanTotals('starter');
assert.strictEqual(starter.monthlyExVatPence, 1900);
assert.strictEqual(starter.monthlyVatPence, 380);
assert.strictEqual(starter.totalPence, 2280);

const growth = connectedBookingPlanTotals('growth');
assert.strictEqual(growth.monthlyExVatPence, 3900);
assert.strictEqual(growth.totalPence, 4680);

const scale = connectedBookingPlanTotals('scale');
assert.strictEqual(scale.monthlyExVatPence, 9900);
assert.strictEqual(scale.totalPence, 11880);

console.log('test-connected-booking-subscriptions: ok');
