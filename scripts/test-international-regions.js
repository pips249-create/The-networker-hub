#!/usr/bin/env node
/**
 * Region map integrity: no duplicate country codes, seed matches server module.
 */
const assert = require('assert');
const {
  REGIONS,
  COUNTRY_TO_REGION,
  regionForCountry,
} = require('../api/_lib/international-regions');

global.window = global;
require('../js/international-region-seed.js');

assert.ok(Array.isArray(REGIONS) && REGIONS.length >= 10, 'expected region list');

const seen = Object.create(null);
REGIONS.forEach(function (region) {
  assert.ok(region.id && region.name, 'region needs id + name');
  assert.ok(Array.isArray(region.codes) && region.codes.length, region.id + ' needs codes');
  region.codes.forEach(function (code) {
    assert.strictEqual(seen[code], undefined, 'duplicate country ' + code);
    seen[code] = region.id;
    assert.strictEqual(COUNTRY_TO_REGION[code], region.id);
    assert.strictEqual(regionForCountry(code).id, region.id);
  });
});

assert.strictEqual(regionForCountry('ES').id, 'iberia');
assert.strictEqual(regionForCountry('DE').id, 'dach');
assert.strictEqual(regionForCountry('BE').id, 'benelux');
assert.strictEqual(regionForCountry('FR').id, 'france');
assert.strictEqual(regionForCountry('IT').id, 'italy');
assert.strictEqual(regionForCountry('US').id, 'united_states');
assert.strictEqual(regionForCountry('CA').id, 'canada');
assert.strictEqual(regionForCountry('MX').id, 'mexico');
assert.ok(!REGIONS.some(function (r) { return r.id === 'north_america'; }), 'north_america should be split');
assert.notStrictEqual(regionForCountry('IT').id, 'central_eastern_europe');
assert.ok(!REGIONS.some(function (r) { return r.id === 'western_europe'; }), 'western_europe should be split');

const seed = window.INTL_REGION_SEED;
assert.strictEqual(seed.length, REGIONS.length, 'seed region count mismatch');
REGIONS.forEach(function (region, i) {
  const row = seed[i];
  assert.strictEqual(row.id, region.id, 'seed order/id mismatch at ' + i);
  assert.strictEqual(row.name, region.name);
  assert.deepStrictEqual(row.codes, region.codes);
  assert.strictEqual(Boolean(row.marketsList), Boolean(region.marketsList));
});

console.log(
  'test-international-regions: ok (' +
    REGIONS.length +
    ' regions, ' +
    Object.keys(seen).length +
    ' countries)'
);
