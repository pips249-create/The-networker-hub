#!/usr/bin/env node
const assert = require('assert');
const {
  groupLimitForPlan,
  isConnectedPlanActive,
  connectedBookingFreeEnabled,
  connectedBookingPilotGrantPlan,
  connectedBookingFreeDefaultPlan,
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
assert.strictEqual(groupLimitForPlan('enterprise'), null);

// Free Connected: pilot grants are unlimited (enterprise) — no slot assignment UX.
assert.strictEqual(connectedBookingFreeEnabled(), true);
assert.strictEqual(connectedBookingPilotGrantPlan(), connectedBookingFreeDefaultPlan());
assert.strictEqual(groupLimitForPlan(connectedBookingPilotGrantPlan()), null);

const enterpriseMeta = connectedBookingSlotsMeta(
  { connected_booking_status: 'active', connected_booking_plan: 'enterprise' },
  {
    schemaMissing: false,
    organisers: [{ id: 'a', slotAssigned: false }],
  }
);
assert.strictEqual(enterpriseMeta.needsAssignment, false);

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
