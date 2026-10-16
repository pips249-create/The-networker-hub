#!/usr/bin/env node
const assert = require('assert');

// Mirror helpers from api/_lib/routes/organiser-events.js (not exported from handler).
function normalizeOccurrences(body) {
  if (Array.isArray(body.occurrences) && body.occurrences.length) {
    return body.occurrences
      .map((o) => ({
        date: o.date || o.start || o.dateTime || '',
        endDate: o.endDate || o.end || '',
      }))
      .filter((o) => o.date);
  }
  const dates = Array.isArray(body.dates) ? body.dates.filter(Boolean) : [];
  if (dates.length) {
    return dates.map((date) => ({ date, endDate: body.endDate || '' }));
  }
  const single = body.date || body.dateTime || '';
  return single ? [{ date: single, endDate: body.endDate || '' }] : [];
}

function occurrencesFromExistingEvent(existing) {
  if (!existing) return [];
  const date = String(existing.date || existing.startsAt || existing.starts_at || '').trim();
  if (!date) return [];
  const endDate = String(existing.endDate || existing.endsAt || existing.ends_at || '').trim();
  return [{ date, endDate }];
}

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
    bodyHas(body, 'external_price_label');
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

function eventPayloadFromBody(body, email, opts) {
  const mode = opts && opts.mode === 'create' ? 'create' : 'update';
  const includeListingDefaults = mode === 'create';
  const payload = {
    email,
    groupId: String(body.organiserGroupId || body.groupId || '').trim(),
    title: String(body.title || '').trim(),
  };
  if (includeListingDefaults || bodyHas(body, 'type') || bodyHas(body, 'format')) {
    payload.type = String(body.type || body.format || 'Meeting').trim();
  }
  if (includeListingDefaults || bodyHas(body, 'venue')) {
    payload.venue = String(body.venue || '').trim();
  }
  if (includeListingDefaults || bodyHas(body, 'city')) {
    payload.city = String(body.city || '').trim();
  }
  if (includeListingDefaults || bodyHas(body, 'postcode')) {
    payload.postcode = String(body.postcode || '').trim();
  }
  if (body.listingStatus != null) {
    payload.listingStatus = body.listingStatus;
  }
  if (bodyHas(body, 'checkoutMode') || bodyHas(body, 'checkout_mode')) {
    payload.checkoutMode = body.checkoutMode || body.checkout_mode;
  }
  if (bodyHas(body, 'externalBookingUrl') || bodyHas(body, 'external_booking_url')) {
    payload.externalBookingUrl = body.externalBookingUrl || body.external_booking_url;
  }
  if (bodyHas(body, 'externalPriceLabel') || bodyHas(body, 'external_price_label')) {
    payload.externalPriceLabel = body.externalPriceLabel || body.external_price_label;
  }
  payload._editorEmail = String(email || '').trim();
  return payload;
}

const patchBody = { listingStatus: 'published', checkoutMode: 'external_connected' };
let occ = normalizeOccurrences(patchBody);
assert.strictEqual(occ.length, 0);
occ = occurrencesFromExistingEvent({ date: '2026-10-01T18:00:00.000Z', endDate: '2026-10-01T21:00:00.000Z' });
assert.strictEqual(occ.length, 1);
assert.strictEqual(occ[0].date, '2026-10-01T18:00:00.000Z');

const linkOutBody = {
  id: 'evt_1',
  title: 'The MarTech Summit London 2026',
  organiserGroupId: 'org_1',
  checkoutMode: 'external_link',
  externalPriceLabel: 'From £455.00',
  externalBookingUrl: 'https://themartechsummit.com/london-registration',
  listingStatus: 'published',
  externalBookingOnly: true,
  date: '2026-10-01T18:00:00.000Z',
};
assert.strictEqual(isExternalBookingOnlyPatch(linkOutBody), true);
assert.strictEqual(
  isExternalBookingOnlyPatch({
    checkoutMode: 'external_link',
    externalBookingUrl: 'https://example.com',
    venue: 'ExCeL London',
  }),
  false
);

const updatePayload = eventPayloadFromBody(linkOutBody, 'organiser@example.com');
assert.strictEqual(updatePayload.checkoutMode, 'external_link');
assert.strictEqual(updatePayload.type, undefined, 'partial PATCH must not invent type=Meeting');
assert.strictEqual(updatePayload.venue, undefined, 'partial PATCH must not invent empty venue');
assert.strictEqual(updatePayload.city, undefined);

const createPayload = eventPayloadFromBody(
  { title: 'New event', organiserGroupId: 'org_1' },
  'organiser@example.com',
  { mode: 'create' }
);
assert.strictEqual(createPayload.type, 'Meeting');

console.log('test-organiser-events-connected-publish: ok');
