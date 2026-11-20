#!/usr/bin/env node
const assert = require('assert');
const {
  mapPublicEvent,
  buildPublicEventsQuery,
  hasGuestVisit,
} = require('../api/_lib/public-events-feed');
const { mapPublicOrganiser } = require('../api/_lib/public-organisers-feed');

function pass(msg) {
  console.log('OK:', msg);
}

const origin = 'https://www.thenetworkeruk.com';
const mapped = mapPublicEvent(
  {
    title: 'Manchester Business Breakfast',
    slug: 'manchester-business-breakfast',
    organiser: 'Example Networking Group',
    organiserSlug: 'example-networking-group',
    city: 'Manchester',
    venueName: 'City centre hotel',
    venueAddress: '1 Deansgate, Manchester',
    date: 'Tuesday, 25 November 2026',
    dateRaw: '2026-11-25T08:00:00.000Z',
    endDateRaw: '2026-11-25T10:00:00.000Z',
    time: '08:00 – 10:00',
    price: '£15.00',
    priceKey: 'paid',
    hasFreeTickets: false,
    guestVisitTier: { id: 'gv1' },
    eventType: 'Meeting',
    format: 'In person',
    externalBookingUrl: '',
    isEventPast: false,
    isSoldOut: false,
    createdAt: '2026-10-01T12:00:00.000Z',
  },
  origin
);

assert.strictEqual(mapped.name, 'Manchester Business Breakfast');
assert.strictEqual(mapped.url, origin + '/events/manchester-business-breakfast');
assert.strictEqual(mapped.organiserUrl, origin + '/organisers/example-networking-group');
assert.strictEqual(mapped.city, 'Manchester');
assert.strictEqual(mapped.guestVisit, true);
assert.strictEqual(mapped.bookingUrl, origin + '/events/manchester-business-breakfast');
assert.strictEqual(mapped.status, 'published');
pass('mapPublicEvent shape');

assert.strictEqual(hasGuestVisit({ complimentaryVisitsAllowed: 2 }), true);
assert.strictEqual(hasGuestVisit({ guestPassesDisabled: true }), false);
pass('guest visit detection');

const q = buildPublicEventsQuery({ location: 'Leeds', free: '1' });
assert.strictEqual(q.sort, 'date');
assert.strictEqual(q.meta, '0');
assert.strictEqual(q.location, 'Leeds');
assert.strictEqual(q.free, '1');
pass('buildPublicEventsQuery defaults');

const org = mapPublicOrganiser(
  {
    name: 'BITA - Liverpool',
    slug: 'bita-liverpool',
    description: 'Business networking in Liverpool',
    rating: 4.2,
    reviews: 12,
    eventCount: 3,
    guestVisitsAllowed: 1,
    locations: [{ city: 'Liverpool' }],
  },
  origin
);
assert.strictEqual(org.url, origin + '/organisers/bita-liverpool');
assert.strictEqual(org.city, 'Liverpool');
assert.strictEqual(org.guestVisits, true);
pass('mapPublicOrganiser shape');

console.log('All public feed tests passed.');
