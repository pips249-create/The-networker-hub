#!/usr/bin/env node
/**
 * External booking promo / note normalisation + PATCH payload wiring.
 */
const assert = require('assert');
const {
  normalizeExternalBookingNote,
  normalizeExternalPriceLabel,
} = require('../api/_lib/connected-booking-util');

assert.strictEqual(normalizeExternalBookingNote(''), '');
assert.strictEqual(normalizeExternalBookingNote('   '), '');
assert.strictEqual(
  normalizeExternalBookingNote('  Use code NETWORKER20 for 20% off  '),
  'Use code NETWORKER20 for 20% off'
);
assert.strictEqual(
  normalizeExternalBookingNote('Line one\n\nLine two'),
  'Line one Line two'
);

const long = 'x'.repeat(200);
assert.strictEqual(normalizeExternalBookingNote(long).length, 160);

assert.strictEqual(normalizeExternalPriceLabel('From £455.00'), 'From £455.00');

function bodyHas(body, key) {
  return Boolean(body) && Object.prototype.hasOwnProperty.call(body, key);
}

function isExternalBookingOnlyPatch(body) {
  if (!body || typeof body !== 'object') return false;
  if (body.externalBookingOnly === true || body.externalBookingOnly === 'true') return true;
  const touchesExternal =
    bodyHas(body, 'checkoutMode') ||
    bodyHas(body, 'checkout_mode') ||
    bodyHas(body, 'externalBookingUrl') ||
    bodyHas(body, 'external_booking_url') ||
    bodyHas(body, 'externalPriceLabel') ||
    bodyHas(body, 'external_price_label') ||
    bodyHas(body, 'externalBookingNote') ||
    bodyHas(body, 'external_booking_note');
  if (!touchesExternal) return false;
  const listingShapeKeys = [
    'type',
    'format',
    'location',
    'venue',
    'addressLine1',
    'city',
    'postcode',
    'fullAddress',
    'eventFormat',
    'onlinePlatform',
    'onlineLink',
    'description',
    'photoBase64',
    'imageBase64',
    'photoUrl',
    'imageUrl',
    'occurrences',
    'dates',
    'attendeeExtras',
  ];
  return !listingShapeKeys.some((key) => bodyHas(body, key));
}

function eventPayloadFromBody(body, email) {
  const payload = {
    email,
    groupId: String(body.organiserGroupId || body.groupId || '').trim(),
    title: String(body.title || '').trim(),
  };
  if (bodyHas(body, 'checkoutMode') || bodyHas(body, 'checkout_mode')) {
    payload.checkoutMode = body.checkoutMode || body.checkout_mode;
  }
  if (bodyHas(body, 'externalBookingUrl') || bodyHas(body, 'external_booking_url')) {
    payload.externalBookingUrl = body.externalBookingUrl || body.external_booking_url;
  }
  if (bodyHas(body, 'externalPriceLabel') || bodyHas(body, 'external_price_label')) {
    payload.externalPriceLabel = body.externalPriceLabel || body.external_price_label;
  }
  if (bodyHas(body, 'externalBookingNote')) {
    payload.externalBookingNote = body.externalBookingNote;
  } else if (bodyHas(body, 'external_booking_note')) {
    payload.externalBookingNote = body.external_booking_note;
  }
  return payload;
}

const notePatch = {
  checkoutMode: 'external_link',
  externalPriceLabel: 'From £455.00',
  externalBookingUrl: 'https://themartechsummit.com/london-registration',
  externalBookingNote: 'Use code NETWORKER20 for 20% off',
  externalBookingOnly: true,
  listingStatus: 'published',
};
assert.strictEqual(isExternalBookingOnlyPatch(notePatch), true);

const payload = eventPayloadFromBody(notePatch, 'organiser@example.com');
assert.strictEqual(payload.externalBookingNote, 'Use code NETWORKER20 for 20% off');
assert.strictEqual(payload.checkoutMode, 'external_link');

const clearNote = eventPayloadFromBody(
  { externalBookingNote: '', checkoutMode: 'external_link', externalBookingOnly: true },
  'organiser@example.com'
);
assert.strictEqual(clearNote.externalBookingNote, '');
assert.strictEqual(isExternalBookingOnlyPatch(clearNote), true);

console.log('test-external-booking-note: ok');
