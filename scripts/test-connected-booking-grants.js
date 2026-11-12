/**
 * Unit checks for Command Centre Connected / Link Out grant helpers.
 */
const assert = require('assert');
const {
  normalizePlan,
  mapGrantAccount,
  findAllOrganiserAccountsByEmail,
} = require('../api/_lib/connected-booking-grants');
const {
  CHECKOUT_HUB,
  CHECKOUT_EXTERNAL,
  CHECKOUT_LINK_OUT,
  accountHasAdminConnectedGrant,
  accountHasLinkOutGrant,
  isExternalCheckoutEvent,
  isExternalLinkOutEvent,
  resolveRequestedCheckoutMode,
  connectedBookingFreeEnabled,
  connectedBookingFreeDefaultPlan,
} = require('../api/_lib/connected-booking-util');

// Free Connected collapses Command Centre plan picks to unlimited enterprise.
assert.strictEqual(connectedBookingFreeEnabled(), true);
assert.strictEqual(normalizePlan('growth'), connectedBookingFreeDefaultPlan());
assert.strictEqual(normalizePlan('nope'), connectedBookingFreeDefaultPlan());
assert.strictEqual(CHECKOUT_LINK_OUT, 'external_link');
assert.strictEqual(typeof findAllOrganiserAccountsByEmail, 'function');

assert.strictEqual(
  accountHasAdminConnectedGrant({ connected_booking_granted_at: '2026-10-16T00:00:00Z' }),
  true
);
assert.strictEqual(accountHasAdminConnectedGrant({}), false);
assert.strictEqual(accountHasLinkOutGrant({ link_out_granted_at: '2026-10-16T00:00:00Z' }), true);
assert.strictEqual(isExternalLinkOutEvent({ checkout_mode: 'external_link' }), true);
assert.strictEqual(isExternalCheckoutEvent({ checkout_mode: 'external_link' }), true);
assert.strictEqual(isExternalCheckoutEvent({ checkout_mode: 'external_connected' }), true);
assert.strictEqual(isExternalCheckoutEvent({ checkout_mode: 'hub' }), false);

assert.strictEqual(
  resolveRequestedCheckoutMode(CHECKOUT_EXTERNAL, { canConnected: true, canLinkOut: true }),
  CHECKOUT_EXTERNAL
);
assert.strictEqual(
  resolveRequestedCheckoutMode(CHECKOUT_EXTERNAL, { canConnected: false, canLinkOut: true }),
  CHECKOUT_LINK_OUT
);
assert.strictEqual(
  resolveRequestedCheckoutMode(CHECKOUT_EXTERNAL, { canConnected: false, canLinkOut: false }),
  CHECKOUT_HUB
);
assert.strictEqual(
  resolveRequestedCheckoutMode(CHECKOUT_LINK_OUT, { canConnected: false, canLinkOut: true }),
  CHECKOUT_LINK_OUT
);

const mapped = mapGrantAccount({
  id: 'acc-1',
  email: 'TNguyen@TheMartechSummit.com',
  connected_booking_plan: 'starter',
  connected_booking_status: 'active',
  connected_booking_granted_at: '2026-10-16T00:00:00Z',
  link_out_granted_at: null,
});
assert.strictEqual(mapped.email, 'tnguyen@themartechsummit.com');
assert.strictEqual(mapped.hasConnectedGrant, true);
assert.strictEqual(mapped.hasLinkOutGrant, false);
assert.strictEqual(mapped.connectedBookingActive, true);

console.log('test-connected-booking-grants: ok');
