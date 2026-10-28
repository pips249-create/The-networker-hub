/**
 * Unit checks for Eventbrite org event list / import helpers.
 * Run: node scripts/test-eventbrite-org-events-list.js
 */
const assert = require('assert');
const {
  mapEventbriteEventToListingPatch,
  eventbriteTitleText,
  eventbritePriceLabelFromEvent,
} = require('../api/_lib/connected-booking-providers/adapters/eventbrite-api');
const {
  eventbriteImportAutoPublishEnabled,
} = require('../api/_lib/connected-booking-util');
const {
  shouldAutoPublishEventbriteImport,
} = require('../api/_lib/eventbrite-listing-import');

function testTitleAndLogoPatch() {
  const evt = {
    id: '123',
    name: { text: 'Friday breakfast networking' },
    description: { text: 'Tea and coffee included.' },
    start: { utc: '2026-11-12T07:30:00Z' },
    end: { utc: '2026-11-12T09:00:00Z' },
    url: 'https://www.eventbrite.co.uk/e/friday-breakfast-tickets-123',
    online_event: false,
    is_free: false,
    venue: {
      name: 'The Coffee Room',
      address: { address_1: '1 High St', city: 'Birmingham', postal_code: 'B1 1AA' },
    },
    logo: { original: { url: 'https://cdn.example.com/event.jpg' } },
    ticket_classes: [
      { free: false, cost: { value: 1500, display: '£15.00' } },
      { free: false, cost: { value: 2500, display: '£25.00' } },
    ],
  };
  assert.strictEqual(eventbriteTitleText(evt), 'Friday breakfast networking');
  assert.strictEqual(eventbritePriceLabelFromEvent(evt), 'From £15');
  const patch = mapEventbriteEventToListingPatch(evt);
  assert.strictEqual(patch.title, 'Friday breakfast networking');
  assert.ok(patch.externalBookingUrl);
  assert.strictEqual(patch.photoUrl, 'https://cdn.example.com/event.jpg');
  assert.strictEqual(patch.city, 'Birmingham');
  assert.strictEqual(patch.externalPriceLabel, 'From £15');
  console.log('ok title/logo/listing/price patch');
}

function testFreeAndSinglePrice() {
  assert.strictEqual(eventbritePriceLabelFromEvent({ is_free: true }), 'Free');
  assert.strictEqual(
    eventbritePriceLabelFromEvent({
      ticket_classes: [{ free: false, cost: { value: 900, display: '£9.00' } }],
    }),
    '£9'
  );
  assert.strictEqual(
    eventbritePriceLabelFromEvent({
      ticket_classes: [{ free: true }, { free: true, donation: true }],
    }),
    'Free'
  );
  assert.strictEqual(eventbritePriceLabelFromEvent({ is_free: false, ticket_classes: [] }), '');
  console.log('ok free/single price labels');
}

function testAutoPublishDecision() {
  const complete = {
    date: '2026-11-12T07:30:00Z',
    externalBookingUrl: 'https://www.eventbrite.co.uk/checkout-external?eid=123',
    externalPriceLabel: 'From £15',
  };
  assert.strictEqual(shouldAutoPublishEventbriteImport(complete, {}), true);
  assert.strictEqual(shouldAutoPublishEventbriteImport(complete, { publish: false }), false);
  assert.strictEqual(
    shouldAutoPublishEventbriteImport(
      { date: '2026-11-12T07:30:00Z', externalBookingUrl: 'https://x.test' },
      {}
    ),
    false
  );
  assert.strictEqual(
    shouldAutoPublishEventbriteImport({ externalPriceLabel: 'Free' }, { publish: true }),
    true
  );

  const prev = process.env.EVENTBRITE_IMPORT_AUTO_PUBLISH;
  process.env.EVENTBRITE_IMPORT_AUTO_PUBLISH = 'false';
  assert.strictEqual(eventbriteImportAutoPublishEnabled(), false);
  assert.strictEqual(shouldAutoPublishEventbriteImport(complete, {}), false);
  if (prev == null) delete process.env.EVENTBRITE_IMPORT_AUTO_PUBLISH;
  else process.env.EVENTBRITE_IMPORT_AUTO_PUBLISH = prev;
  console.log('ok auto-publish decision');
}

testTitleAndLogoPatch();
testFreeAndSinglePrice();
testAutoPublishDecision();
console.log('All tests passed.');
