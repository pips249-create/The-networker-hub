#!/usr/bin/env node
/**
 * Link Out / Connected lean publish must cover every date id passed from setup
 * (and expand series peers), not only the anchor event id.
 */
const assert = require('assert');

function seedExternalBookingPublishIds(eventId, payloadEventIds) {
  const id = String(eventId || '').trim();
  const extras = (Array.isArray(payloadEventIds) ? payloadEventIds : [])
    .map((raw) => String(raw || '').trim())
    .filter(Boolean);
  return [...new Set([id, ...extras].filter(Boolean))];
}

assert.deepStrictEqual(seedExternalBookingPublishIds('a', ['a', 'b']), ['a', 'b']);
assert.deepStrictEqual(seedExternalBookingPublishIds('a', ['b']), ['a', 'b']);
assert.deepStrictEqual(seedExternalBookingPublishIds('a', []), ['a']);
assert.deepStrictEqual(seedExternalBookingPublishIds('a', null), ['a']);

console.log('test-external-booking-series-publish: ok');
