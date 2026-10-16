#!/usr/bin/env node
/**
 * Ensure public external listings keep Link Out vs Connected mode distinct,
 * so the event page can hide Hub booking fees for off-site checkout.
 */
const assert = require('assert');

function mapExternalCheckoutMode(row) {
  return String(row.checkout_mode || '').trim() === 'external_link'
    ? 'external_link'
    : 'external_connected';
}

assert.strictEqual(
  mapExternalCheckoutMode({ checkout_mode: 'external_link' }),
  'external_link'
);
assert.strictEqual(
  mapExternalCheckoutMode({ checkout_mode: 'external_connected' }),
  'external_connected'
);
assert.strictEqual(
  mapExternalCheckoutMode({ checkout_mode: 'hub', external_booking_url: 'https://x.test' }),
  'external_connected'
);

console.log('test-external-booking-listing-mode: ok');
