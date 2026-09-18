#!/usr/bin/env node
const assert = require('assert');
const { groupLimitForPlan } = require('../api/_lib/connected-booking-util');

assert.strictEqual(groupLimitForPlan('starter'), 1);
assert.strictEqual(groupLimitForPlan('growth'), 5);

console.log('test-connected-booking-slots: ok');
