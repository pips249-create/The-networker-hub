#!/usr/bin/env node
/**
 * Venue / location display must ignore placeholder “TBC” and fall back to real fields.
 */
const assert = require('assert');

function isPlaceholderLocationText(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!s) return true;
  return (
    s === 'tbc' ||
    s === 'tba' ||
    s === 'tbd' ||
    s === 'venue tbc' ||
    s === 'location tbc' ||
    s === 'venue tba' ||
    s === 'location tba' ||
    s === 'to be confirmed' ||
    s === 'to be announced' ||
    s === 'coming soon'
  );
}

function firstRealLocationPart(parts) {
  for (let i = 0; i < (parts || []).length; i++) {
    const part = String(parts[i] || '').trim();
    if (part && !isPlaceholderLocationText(part)) return part;
  }
  return '';
}

assert.strictEqual(isPlaceholderLocationText('Venue TBC'), true);
assert.strictEqual(isPlaceholderLocationText('TBC'), true);
assert.strictEqual(isPlaceholderLocationText('Convene 155 Bishopsgate'), false);

const { isVenueTbcText, cityFromVenueTbcLabel, applyVenueTbcFields } = require('../api/_lib/venue-tbc');
assert.strictEqual(isVenueTbcText('Milton Keynes (venue TBC – announced to registrants)'), true);
assert.strictEqual(isVenueTbcText('The Exchange'), false);
assert.strictEqual(
  cityFromVenueTbcLabel('Milton Keynes (venue TBC – announced to registrants)'),
  'Milton Keynes'
);
const tbcRow = applyVenueTbcFields(
  {
    venue: 'Milton Keynes (venue TBC – announced to registrants)',
    address: 'Midsummer Boulevard',
    postcode: 'MK9 1AA',
    latitude: 52.04,
    longitude: -0.76,
    city: 'Milton Keynes',
  },
  'Milton Keynes'
);
assert.strictEqual(tbcRow.venue, 'Venue TBC');
assert.strictEqual(tbcRow.city, 'Milton Keynes');
assert.strictEqual(tbcRow.address, null);
assert.strictEqual(tbcRow.postcode, null);
assert.strictEqual(tbcRow.latitude, null);
assert.strictEqual(tbcRow.location_label, 'Milton Keynes');

const wiped = {
  venue: '',
  venueName: 'TBC',
  location: 'Convene 155 Bishopsgate, London',
  city: 'London',
};
assert.strictEqual(
  firstRealLocationPart([wiped.venue, wiped.venueName, wiped.location, wiped.city]),
  'Convene 155 Bishopsgate, London'
);

const onlyCoords = { venue: '', location: '', city: '' };
assert.strictEqual(
  firstRealLocationPart([onlyCoords.venue, onlyCoords.location, onlyCoords.city]),
  ''
);

console.log('test-event-location-placeholder: ok');
