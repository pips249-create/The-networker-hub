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
  connectedBookingAllowedForEmail,
} = require('../api/_lib/connected-booking-util');

const free = parseExternalPriceLabelToDisplay('Free');
assert.strictEqual(free.priceKey, 'free');

const paid = parseExternalPriceLabelToDisplay('£12');
assert.strictEqual(paid.priceNum, 12);

const froTypo = parseExternalPriceLabelToDisplay('Fro £455.00');
assert.strictEqual(froTypo.display, 'From £455.00');
assert.strictEqual(froTypo.priceNum, 455);

const fromLower = parseExternalPriceLabelToDisplay('from £12');
assert.strictEqual(fromLower.display, 'From £12');

const secret = newWebhookSecret();
const body = Buffer.from(JSON.stringify({ orderId: 'a', eventId: 'b' }), 'utf8');
const sig = signWebhookPayload(secret, body);
assert.ok(verifyWebhookSignature(secret, body, sig));
assert.ok(!verifyWebhookSignature(secret, body, 'bad'));

const prevPreview = process.env.CONNECTED_BOOKING_PREVIEW_EMAILS;
const prevEnabled = process.env.CONNECTED_BOOKING_ENABLED;
const prevPilot = process.env.CONNECTED_BOOKING_PILOT_GRANT_EMAILS;

process.env.CONNECTED_BOOKING_ENABLED = 'false';
process.env.CONNECTED_BOOKING_PREVIEW_EMAILS = 'pips249@gmail.com';
delete require.cache[require.resolve('../api/_lib/connected-booking-util')];
const utilPreview = require('../api/_lib/connected-booking-util');
assert.strictEqual(utilPreview.connectedBookingAllowedForEmail('pips249@gmail.com'), true);
assert.strictEqual(utilPreview.connectedBookingAllowedForEmail('other@example.com'), false);
process.env.CONNECTED_BOOKING_PILOT_GRANT_EMAILS = 'pilot@test.com';
delete require.cache[require.resolve('../api/_lib/connected-booking-util')];
const utilPilotPreview = require('../api/_lib/connected-booking-util');
assert.strictEqual(
  utilPilotPreview.connectedBookingAllowedForEmail('pilot@test.com'),
  true,
  'pilot grant email allowed while preview list is locked'
);
assert.strictEqual(utilPilotPreview.connectedBookingAllowedForEmail('other@example.com'), false);

// Open to everyone: no preview list + default ENABLED (unset) → all signed-in emails allowed.
delete process.env.CONNECTED_BOOKING_PREVIEW_EMAILS;
delete process.env.CONNECTED_BOOKING_ENABLED;
delete process.env.CONNECTED_BOOKING_PILOT_GRANT_EMAILS;
delete require.cache[require.resolve('../api/_lib/connected-booking-util')];
const utilOpenDefault = require('../api/_lib/connected-booking-util');
assert.strictEqual(utilOpenDefault.connectedBookingFeatureEnabled(), true, 'ENABLED defaults on');
assert.strictEqual(utilOpenDefault.connectedBookingAllowedForEmail('any@example.com'), true);
assert.strictEqual(utilOpenDefault.connectedBookingOperationsEnabled(), true);

// Explicit kill-switch still works when preview list is empty.
process.env.CONNECTED_BOOKING_ENABLED = 'false';
delete require.cache[require.resolve('../api/_lib/connected-booking-util')];
const utilKill = require('../api/_lib/connected-booking-util');
assert.strictEqual(utilKill.connectedBookingFeatureEnabled(), false);
assert.strictEqual(utilKill.connectedBookingAllowedForEmail('any@example.com'), false);

if (prevPreview) process.env.CONNECTED_BOOKING_PREVIEW_EMAILS = prevPreview;
else delete process.env.CONNECTED_BOOKING_PREVIEW_EMAILS;
if (prevEnabled) process.env.CONNECTED_BOOKING_ENABLED = prevEnabled;
else delete process.env.CONNECTED_BOOKING_ENABLED;
if (prevPilot) process.env.CONNECTED_BOOKING_PILOT_GRANT_EMAILS = prevPilot;
else delete process.env.CONNECTED_BOOKING_PILOT_GRANT_EMAILS;
delete require.cache[require.resolve('../api/_lib/connected-booking-util')];

process.env.CONNECTED_BOOKING_PILOT_GRANT_EMAILS = 'pilot@test.com';
delete require.cache[require.resolve('../api/_lib/connected-booking-util')];
const utilPilot = require('../api/_lib/connected-booking-util');
assert.strictEqual(utilPilot.connectedBookingPilotGrantEligible('pilot@test.com'), true);
assert.strictEqual(utilPilot.connectedBookingPilotGrantEligible('other@test.com'), false);
// Free connect → pilot plan is unlimited (enterprise), not starter slot caps.
assert.strictEqual(utilPilot.connectedBookingPilotGrantPlan(), utilPilot.connectedBookingFreeDefaultPlan());
delete process.env.CONNECTED_BOOKING_PILOT_GRANT_EMAILS;
delete require.cache[require.resolve('../api/_lib/connected-booking-util')];

console.log('test-external-booking-webhook: ok');
