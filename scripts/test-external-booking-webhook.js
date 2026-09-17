#!/usr/bin/env node
/**
 * Unit checks for Connected booking helpers (no network).
 *   node scripts/test-external-booking-webhook.js
 */
const assert = require('assert');
const {
  parseExternalPriceLabelToDisplay,
  signWebhookPayload,
  verifyWebhookSignature,
  newWebhookSecret,
} = require('../api/_lib/connected-booking-util');

const free = parseExternalPriceLabelToDisplay('Free');
assert.strictEqual(free.priceKey, 'free');

const paid = parseExternalPriceLabelToDisplay('£12');
assert.strictEqual(paid.priceNum, 12);

const secret = newWebhookSecret();
const body = Buffer.from(JSON.stringify({ orderId: 'a', eventId: 'b' }), 'utf8');
const sig = signWebhookPayload(secret, body);
assert.ok(verifyWebhookSignature(secret, body, sig));
assert.ok(!verifyWebhookSignature(secret, body, 'bad'));

const prevPreview = process.env.CONNECTED_BOOKING_PREVIEW_EMAILS;
const prevEnabled = process.env.CONNECTED_BOOKING_ENABLED;
process.env.CONNECTED_BOOKING_ENABLED = 'false';
process.env.CONNECTED_BOOKING_PREVIEW_EMAILS = 'pips249@gmail.com';
delete require.cache[require.resolve('../api/_lib/connected-booking-util')];
const utilPreview = require('../api/_lib/connected-booking-util');
assert.strictEqual(utilPreview.connectedBookingAllowedForEmail('pips249@gmail.com'), true);
assert.strictEqual(utilPreview.connectedBookingAllowedForEmail('other@example.com'), false);
process.env.CONNECTED_BOOKING_PREVIEW_EMAILS = prevPreview || '';
process.env.CONNECTED_BOOKING_ENABLED = prevEnabled || '';
delete require.cache[require.resolve('../api/_lib/connected-booking-util')];

console.log('test-external-booking-webhook: ok');
