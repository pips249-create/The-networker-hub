#!/usr/bin/env node
/**
 * Link Out / Connected listing prices must keep the organiser’s label
 * (e.g. “From £455.00”) and must not add the Hub booking fee.
 */
const assert = require('assert');
const path = require('path');
const vm = require('vm');
const fs = require('fs');

const code = fs.readFileSync(path.join(__dirname, '../js/booking-fees.js'), 'utf8');
const sandbox = { window: {}, globalThis: {} };
sandbox.global = sandbox;
vm.runInNewContext(code, sandbox);
const fees = sandbox.window.HubBookingFees || sandbox.globalThis.HubBookingFees;
assert.ok(fees, 'HubBookingFees loaded');

const linkOut = {
  checkoutMode: 'external_link',
  externalBookingUrl: 'https://themartechsummit.com/london-registration',
  externalPriceLabel: 'From £455.00',
  price: 'From £455.00',
  priceKey: 'paid',
  priceNum: 455,
};

assert.strictEqual(fees.listingUsesExternalBooking(linkOut), true);
assert.strictEqual(fees.listingPriceLabel(linkOut), 'From £455.00');
assert.strictEqual(fees.listingPriceNum(linkOut), 455);
assert.ok(fees.listingPriceNum(linkOut) < 475, 'must not include Hub booking fee');

const froTypo = Object.assign({}, linkOut, {
  externalPriceLabel: 'Fro £455.00',
  price: 'Fro £455.00',
});
assert.strictEqual(fees.listingPriceLabel(froTypo), 'From £455.00');

const connected = {
  checkoutMode: 'external_connected',
  externalBookingUrl: 'https://www.eventbrite.co.uk/e/123',
  externalPriceLabel: 'From £12',
  priceNum: 12,
  priceKey: 'paid',
};
assert.strictEqual(fees.listingPriceLabel(connected), 'From £12');
assert.strictEqual(fees.listingPriceNum(connected), 12);

const hub = {
  checkoutMode: 'hub',
  priceKey: 'paid',
  priceNum: 100,
  vatTreatment: 'included',
};
assert.ok(fees.listingPriceNum(hub) > 100, 'Hub paid tickets still include booking fee');

console.log('test-booking-fees-external-label: ok');
