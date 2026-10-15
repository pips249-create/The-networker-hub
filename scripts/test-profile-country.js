#!/usr/bin/env node
const assert = require('assert');
const {
  normalizeCountryCode,
  isUkCountryCode,
  countryName,
  countryOptions,
  placeFromProfile,
} = require('../js/profile-countries');
const { nearbySectionHeading, nearbySectionSubtitle } = require('../api/_lib/nearby-events');

assert.strictEqual(normalizeCountryCode(''), 'GB');
assert.strictEqual(normalizeCountryCode('  '), 'GB');
assert.strictEqual(normalizeCountryCode('uk'), 'GB');
assert.strictEqual(normalizeCountryCode('United Kingdom'), 'GB');
assert.strictEqual(normalizeCountryCode('US'), 'US');
assert.strictEqual(normalizeCountryCode('Ireland'), 'IE');
assert.strictEqual(isUkCountryCode(''), true);
assert.strictEqual(isUkCountryCode('GB'), true);
assert.strictEqual(isUkCountryCode('US'), false);

assert.strictEqual(countryName('GB'), 'United Kingdom');
assert.strictEqual(countryName('US'), 'United States');

const options = countryOptions();
assert.strictEqual(options[0].code, 'GB');
assert.strictEqual(options[0].name, 'United Kingdom');
assert.ok(options.some((row) => row.code === 'IE' && row.name === 'Ireland'));

assert.throws(() => normalizeCountryCode('Not a country'), /Choose a country/);

assert.deepStrictEqual(placeFromProfile({ location: 'Austin', countryCode: 'US' }), {
  location: 'Austin',
  countryCode: 'US',
});
assert.deepStrictEqual(placeFromProfile({ location: 'Manchester' }), {
  location: 'Manchester',
  countryCode: 'GB',
});

const outside = {
  outsideUk: true,
  source: 'popular_online',
  locationLabel: 'United States',
  radiusMiles: null,
};
const heading = nearbySectionHeading(outside);
const subtitle = nearbySectionSubtitle(outside);
assert.strictEqual(heading, 'Popular online events');
assert.ok(!/miles|near /i.test(heading), heading);
assert.ok(!/miles|near /i.test(subtitle), subtitle);
assert.ok(subtitle.indexOf('Your profile country is United States') !== -1, subtitle);

const ukHeading = nearbySectionHeading({
  source: 'nearby',
  locationLabel: 'Manchester',
  radiusMiles: 25,
});
assert.strictEqual(ukHeading, 'Events within 25 miles of Manchester');

console.log('profile country checks passed');
