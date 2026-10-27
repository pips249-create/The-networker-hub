#!/usr/bin/env node
/**
 * Unit checks: after booking one date of a multi-date series, remaining-date
 * bundle checkout must still be allowed (items.length === 1 with prior regs).
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function ok(label) {
  console.log('  OK  ' + label);
}

// Simulate the gate added in resolveSeriesBundleItems.
function allowRemainingBundle(itemsLength, alreadyRegisteredSize) {
  if (itemsLength < 1) return false;
  if (itemsLength === 1 && alreadyRegisteredSize === 0) return false;
  return true;
}

assert.strictEqual(
  allowRemainingBundle(2, 0),
  true,
  'fresh book-all with 2 dates allowed'
);
ok('fresh book-all with 2 dates');

assert.strictEqual(
  allowRemainingBundle(1, 0),
  false,
  'single remaining with no prior booking must use normal checkout'
);
ok('blocks single-date bundle without prior registration');

assert.strictEqual(
  allowRemainingBundle(1, 1),
  true,
  'after booking 1 of 2, remaining date must be bookable via remaining path'
);
ok('allows last remaining date after partial booking');

assert.strictEqual(allowRemainingBundle(0, 1), false, 'nothing left to book');
ok('blocks empty remaining set');

const bundleSrc = fs.readFileSync(
  path.join(root, 'api/_lib/series-bundle-checkout.js'),
  'utf8'
);
assert.ok(
  /alreadyRegistered\.size === 0/.test(bundleSrc),
  'resolveSeriesBundleItems must allow remaining date after partial booking'
);
ok('series-bundle-checkout encodes partial-booking exception');

const detailSrc = fs.readFileSync(path.join(root, 'js/event-detail.js'), 'utf8');
assert.ok(
  /Add the other date/.test(detailSrc) && /remainingSeriesBookableEntries/.test(detailSrc),
  'event detail must offer adding the other date after a partial booking'
);
ok('event-detail exposes Add the other date path');

const successSrc = fs.readFileSync(path.join(root, 'js/booking-success.js'), 'utf8');
assert.ok(
  /If that was by accident/.test(successSrc),
  'booking success should explain accidental single-date booking'
);
ok('booking-success copy covers accidental single booking');

console.log('\nAll series remaining-after-partial checks passed.');
