#!/usr/bin/env node
const assert = require('assert');
const {
  normalizeInput,
  validateInput,
} = require('../api/_lib/international-event-listings');

const base = {
  title: 'Dublin Founders Breakfast',
  startsOn: '2026-11-12',
  city: 'Dublin',
  countryCode: 'IE',
  countryName: 'Ireland',
  externalUrl: 'https://example.com/book',
  contactName: 'Alex Organiser',
  email: 'alex@example.com',
};

assert.strictEqual(validateInput(normalizeInput(base)).ok, true);

const honeypot = validateInput(normalizeInput({ ...base, website_hp: 'bot' }));
assert.strictEqual(honeypot.ok, true);
assert.strictEqual(honeypot.honeypot, true);

const uk = validateInput(normalizeInput({ ...base, countryCode: 'GB', countryName: 'United Kingdom' }));
assert.strictEqual(uk.ok, false);
assert.strictEqual(uk.error, 'use_uk_site');

const badUrl = validateInput(normalizeInput({ ...base, externalUrl: 'ftp://example.com' }));
assert.strictEqual(badUrl.ok, false);
assert.strictEqual(badUrl.error, 'invalid_url');

const endBeforeStart = validateInput(
  normalizeInput({ ...base, startsOn: '2026-11-12', endsOn: '2026-11-10' })
);
assert.strictEqual(endBeforeStart.ok, false);
assert.strictEqual(endBeforeStart.error, 'invalid_end_date');

const unavailable = validateInput(
  normalizeInput({ ...base, countryCode: 'RU', countryName: 'Russia' })
);
assert.strictEqual(unavailable.ok, false);
assert.strictEqual(unavailable.error, 'country_unavailable');

console.log('test-international-event-listings: ok');
