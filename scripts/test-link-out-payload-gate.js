/**
 * Free Link Out must pass the organiser events external-payload gate even when
 * Connected preview allow-lists block Connected mode.
 */
const assert = require('assert');
const path = require('path');

// Load the same helpers the route uses.
const {
  CHECKOUT_EXTERNAL,
  CHECKOUT_LINK_OUT,
  linkOutFreeEnabled,
  connectedBookingAllowedForEmail,
} = require('../api/_lib/connected-booking-util');

assert.strictEqual(linkOutFreeEnabled(), true, 'Link Out free by default in this environment');

// Mirror the critical branch from connectedBookingPayloadBlocked.
function wouldBlock(sessionEmail, mode) {
  if (connectedBookingAllowedForEmail(sessionEmail)) return false;
  if (linkOutFreeEnabled() && mode !== CHECKOUT_EXTERNAL) return false;
  return true;
}

assert.strictEqual(
  wouldBlock('lynne-not-on-preview@example.com', CHECKOUT_LINK_OUT),
  false,
  'free Link Out must not be blocked by Connected preview'
);
assert.strictEqual(
  wouldBlock('lynne-not-on-preview@example.com', ''),
  false,
  'URL/price-only external edits must not be blocked when Link Out is free'
);
assert.strictEqual(
  wouldBlock('lynne-not-on-preview@example.com', CHECKOUT_EXTERNAL),
  true,
  'Connected mode still blocked without preview/grant when not allow-listed'
);

console.log('test-link-out-payload-gate: ok', path.basename(__filename));
