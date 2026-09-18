#!/usr/bin/env node
const assert = require('assert');
const { groupLimitForPlan } = require('../api/_lib/connected-booking-util');
const { connectedBookingSlotsMeta } = require('../api/_lib/connected-booking-slots');

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

console.log('test-connected-booking-slots: ok');
