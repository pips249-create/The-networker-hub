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

console.log('test-external-booking-webhook: ok');
