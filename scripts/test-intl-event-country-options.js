#!/usr/bin/env node
/**
 * Ensures staff/public link-out country pickers expose the full region seed.
 */
const assert = require('assert');

global.window = global;
require('../js/international-region-seed.js');

assert.strictEqual(typeof window.INTL_EVENT_COUNTRY_OPTIONS, 'function');
const list = window.INTL_EVENT_COUNTRY_OPTIONS();
assert.ok(list.length >= 200, 'expected 200+ countries, got ' + list.length);

const byCode = Object.create(null);
list.forEach(function (row) {
  assert.ok(row.iso2 && row.name, 'row needs iso2 + name');
  assert.strictEqual(byCode[row.iso2], undefined, 'duplicate ' + row.iso2);
  byCode[row.iso2] = row.name;
});

['AR', 'CN', 'PL', 'KE', 'TH', 'IE', 'US', 'ES', 'FR', 'DE'].forEach(function (code) {
  assert.ok(byCode[code], 'missing ' + code);
});

['GB', 'RU', 'IR', 'BY', 'KP', 'SY'].forEach(function (code) {
  assert.strictEqual(byCode[code], undefined, code + ' should be excluded');
});

assert.ok(list[0].name.localeCompare(list[1].name, 'en-GB') <= 0, 'should be sorted');

console.log('test-intl-event-country-options: ok (' + list.length + ' countries)');
