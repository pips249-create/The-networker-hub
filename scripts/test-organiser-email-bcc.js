#!/usr/bin/env node
const assert = require('assert');
const { normalizeBccList } = require('../api/_lib/organiser-email-bcc');

assert.deepStrictEqual(
  normalizeBccList('organiser@example.com', 'attendee@example.com'),
  ['organiser@example.com']
);
assert.deepStrictEqual(
  normalizeBccList(['organiser@example.com', 'organiser@example.com'], 'attendee@example.com'),
  ['organiser@example.com']
);
assert.deepStrictEqual(
  normalizeBccList('attendee@example.com', 'attendee@example.com'),
  [],
  'must not BCC the attendee'
);
assert.deepStrictEqual(normalizeBccList('not-an-email', 'attendee@example.com'), []);
assert.deepStrictEqual(normalizeBccList('', 'attendee@example.com'), []);
assert.deepStrictEqual(normalizeBccList(null, 'attendee@example.com'), []);
console.log('ok — organiser BCC list hides address from attendee To/CC');

console.log('\nAll organiser BCC checks passed.');
