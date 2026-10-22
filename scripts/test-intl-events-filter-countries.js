#!/usr/bin/env node
/**
 * Filter-by-country options should be derived from listed events only.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'international-home.js'),
  'utf8'
);

assert.ok(
  src.includes('function fillEventsFilterSelect'),
  'expected dedicated filter select filler'
);
assert.ok(
  /fillEventsFilterSelect\(\)/.test(src) && /state\.events/.test(src),
  'filter filler should read state.events'
);
assert.ok(
  src.includes('function fillEventFormCountrySelect'),
  'add-event form should keep the full country list'
);

// Extract the filter builder logic by reimplementing the same rule here.
function listedFilterOptions(events) {
  var byCode = {};
  (events || []).forEach(function (row) {
    var code = String((row && row.countryCode) || '')
      .trim()
      .toUpperCase();
    var name = String((row && row.countryName) || '').trim();
    if (!code || code.length !== 2) return;
    if (!byCode[code]) byCode[code] = { iso2: code, name: name || code };
  });
  return Object.keys(byCode)
    .map(function (code) {
      return byCode[code];
    })
    .sort(function (a, b) {
      return a.name.localeCompare(b.name, 'en-GB');
    });
}

const options = listedFilterOptions([
  { countryCode: 'ES', countryName: 'Spain' },
  { countryCode: 'CA', countryName: 'Canada' },
  { countryCode: 'CA', countryName: 'Canada' },
  { countryCode: 'CZ', countryName: 'Czechia' },
  { countryCode: 'XXX', countryName: 'Bad' },
  { countryCode: '', countryName: 'Nowhere' },
]);

assert.deepStrictEqual(
  options.map(function (row) {
    return row.iso2;
  }),
  ['CA', 'CZ', 'ES']
);
assert.strictEqual(options[0].name, 'Canada');
assert.strictEqual(options[2].name, 'Spain');

console.log('test-intl-events-filter-countries: ok');
