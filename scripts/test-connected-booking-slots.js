#!/usr/bin/env node
const assert = require('assert');
const {
  groupLimitForPlan,
  isConnectedPlanActive,
} = require('../api/_lib/connected-booking-util');
const {
  assignConnectedBookingSlots,
  connectedBookingSlotsMeta,
} = require('../api/_lib/connected-booking-slots');

assert.strictEqual(typeof isConnectedPlanActive, 'function');
assert.strictEqual(isConnectedPlanActive({ connected_booking_status: 'active' }), true);
assert.strictEqual(isConnectedPlanActive({ connected_booking_status: 'inactive' }), false);

assert.strictEqual(groupLimitForPlan('starter'), 1);
assert.strictEqual(groupLimitForPlan('growth'), 5);

const meta = connectedBookingSlotsMeta(
  { connected_booking_status: 'active', connected_booking_plan: 'starter' },
  {
    schemaMissing: false,
    organisers: [
      { id: 'a', slotAssigned: true },
      { id: 'b', slotAssigned: false },
    ],
  }
);
assert.deepStrictEqual(meta.assignedOrganiserIds, ['a']);
assert.strictEqual(meta.needsAssignment, false);

(async () => {
  try {
    await assignConnectedBookingSlots(null, { id: 'acc', connected_booking_status: 'inactive' }, []);
    assert.fail('expected inactive plan rejection');
  } catch (e) {
    assert.strictEqual(e.code, 'connected_booking_inactive');
  }
  console.log('test-connected-booking-slots: ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
