#!/usr/bin/env node
/**
 * Unit checks for Featured Event Boost floors (£10 + VAT list price).
 * Run: node scripts/test-featured-listing-quote.js
 */
const {
  FEATURED_DEFAULT_MIN_PENCE,
  FEATURED_DEFAULT_OPEN_MIN_PENCE,
  FEATURED_DEFAULT_MONTHLY_PENCE,
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

assert('list price default is £10', FEATURED_DEFAULT_MONTHLY_PENCE === 1000);
assert('scarce default min is £10', FEATURED_DEFAULT_MIN_PENCE === 1000);
assert('open default min is £10', FEATURED_DEFAULT_OPEN_MIN_PENCE === 1000);
assert('scarce threshold is 3', FEATURED_SCARCE_AVAILABLE_THRESHOLD === 3);

assert('unknown slots use £10 floor', featuredMinPricePenceForSlots(undefined) === 1000);
assert('0 slots use £10 floor', featuredMinPricePenceForSlots(0) === 1000);
assert('3 slots use £10 floor', featuredMinPricePenceForSlots(3) === 1000);
assert('4 slots use £10 floor', featuredMinPricePenceForSlots(4) === 1000);
assert('12 slots use £10 floor', featuredMinPricePenceForSlots(12) === 1000);

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
assert('1-day open quote is £10 floor', openQuote.amountPence === 1000);
assert('1-day open note mentions £10', /min £10\.00/.test(openQuote.pricingNote));

const fullMonth = calculateFeaturedListingQuote({
  planId: '1month',
  eventStartsAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
  slotsAvailable: 8,
});
assert('full month is £10', fullMonth.amountPence === 1000);
assert('full month mode', fullMonth.pricingMode === 'full_term');

if (failed) {
  console.error('\n' + failed + ' check(s) failed');
  process.exit(1);
}
console.log('\nAll featured listing quote checks passed.');
