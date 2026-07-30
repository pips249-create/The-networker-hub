#!/usr/bin/env node
/**
 * Unit checks for Premium Spotlight prorated floors (open vs scarce slots).
 * Run: node scripts/test-featured-listing-quote.js
 */
const {
  FEATURED_DEFAULT_MIN_PENCE,
  FEATURED_DEFAULT_OPEN_MIN_PENCE,
  FEATURED_SCARCE_AVAILABLE_THRESHOLD,
  featuredMinPricePenceForSlots,
  calculateFeaturedListingQuote,
} = require('../api/_lib/event-featured-plans');

let failed = 0;

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

assert('scarce default min is £10', FEATURED_DEFAULT_MIN_PENCE === 1000);
assert('open default min is £5', FEATURED_DEFAULT_OPEN_MIN_PENCE === 500);
assert('scarce threshold is 3', FEATURED_SCARCE_AVAILABLE_THRESHOLD === 3);

assert('unknown slots use scarce floor', featuredMinPricePenceForSlots(undefined) === 1000);
assert('0 slots use scarce floor', featuredMinPricePenceForSlots(0) === 1000);
assert('3 slots use scarce floor', featuredMinPricePenceForSlots(3) === 1000);
assert('4 slots use open floor', featuredMinPricePenceForSlots(4) === 500);
assert('12 slots use open floor', featuredMinPricePenceForSlots(12) === 500);

const inOneDay = new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString();

const scarceQuote = calculateFeaturedListingQuote({
  planId: '1month',
  eventStartsAt: inOneDay,
  slotsAvailable: 2,
});
assert('1-day scarce quote is £10 floor', scarceQuote.amountPence === 1000);
assert('1-day scarce note mentions £10', /min £10\.00/.test(scarceQuote.pricingNote));

const openQuote = calculateFeaturedListingQuote({
  planId: '1month',
  eventStartsAt: inOneDay,
  slotsAvailable: 8,
});
assert('1-day open quote is £5 floor', openQuote.amountPence === 500);
assert('1-day open note mentions £5', /min £5\.00/.test(openQuote.pricingNote));

const inTwoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
const midQuote = calculateFeaturedListingQuote({
  planId: '1month',
  eventStartsAt: inTwoWeeks,
  slotsAvailable: 8,
});
assert(
  '14-day open quote uses pro-rata above floor',
  midQuote.amountPence > 500 && midQuote.amountPence < 5500
);

const fullMonth = calculateFeaturedListingQuote({
  planId: '1month',
  eventStartsAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
  slotsAvailable: 8,
});
assert('full month ignores open floor', fullMonth.amountPence === 5500);
assert('full month mode', fullMonth.pricingMode === 'full_month');

if (failed) {
  console.error('\n' + failed + ' check(s) failed');
  process.exit(1);
}
console.log('\nAll featured listing quote checks passed.');
