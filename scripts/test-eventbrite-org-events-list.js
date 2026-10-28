/**
 * Unit checks for Eventbrite org event list mapping helpers.
 * Run: node scripts/test-eventbrite-org-events-list.js
 */
const assert = require('assert');
const {
  mapEventbriteEventToListingPatch,
  eventbriteTitleText,
} = require('../api/_lib/connected-booking-providers/adapters/eventbrite-api');

function testTitleAndLogoPatch() {
  const evt = {
    id: '123',
    name: { text: 'Friday breakfast networking' },
    description: { text: 'Tea and coffee included.' },
    start: { utc: '2026-11-12T07:30:00Z' },
    end: { utc: '2026-11-12T09:00:00Z' },
    url: 'https://www.eventbrite.co.uk/e/friday-breakfast-tickets-123',
    online_event: false,
    venue: {
      name: 'The Coffee Room',
      address: { address_1: '1 High St', city: 'Birmingham', postal_code: 'B1 1AA' },
    },
    logo: { original: { url: 'https://cdn.example.com/event.jpg' } },
  };
  assert.strictEqual(eventbriteTitleText(evt), 'Friday breakfast networking');
  const patch = mapEventbriteEventToListingPatch(evt);
  assert.strictEqual(patch.title, 'Friday breakfast networking');
  assert.ok(patch.externalBookingUrl);
  assert.strictEqual(patch.photoUrl, 'https://cdn.example.com/event.jpg');
  assert.strictEqual(patch.city, 'Birmingham');
  console.log('ok title/logo/listing patch');
}

testTitleAndLogoPatch();
console.log('All tests passed.');
