#!/usr/bin/env node
/**
 * Listings with no public ticket must not be labelled Free.
 * Run: node scripts/test-unpriced-event-label.js
 */
const assert = require('assert');
const { rowToEvent, publicPriceFromTiers, PRICE_UNKNOWN_KEY } = require('../api/_lib/supabase-events');
const { rowToBrowsePin } = require('../api/_lib/browse-events-query');

const baseRow = {
  id: 'ev-bni',
  title: 'BNI Nexus (Montrose)',
  slug: 'bni-nexus-montrose',
  event_type: 'Meeting',
  meeting_type: 'In person',
  city: 'Montrose',
  starts_at: '2026-10-09T06:30:00+00:00',
  ends_at: '2026-10-09T08:30:00+00:00',
  approval_status: 'Approved',
  status: 'published',
  attendance_mode: 'category_exclusivity',
};

const unpriced = rowToEvent(baseRow, { id: 'org-1', name: 'BNI Nexus (Montrose)' }, []);
assert.strictEqual(unpriced.price, 'Enquire for price');
assert.strictEqual(unpriced.priceKey, PRICE_UNKNOWN_KEY);
assert.strictEqual(unpriced.hasTicketTiers, false);
assert.strictEqual(unpriced.hasFreeTickets, false);

const freeTier = rowToEvent(baseRow, null, [
  {
    id: 't-free',
    event_id: 'ev-bni',
    name: 'Standard',
    ticket_type: 'Standard',
    visibility: 'public',
    price: 0,
    quantity: 20,
  },
]);
assert.strictEqual(freeTier.priceKey, 'free');
assert.strictEqual(freeTier.price, 'Free');
assert.strictEqual(freeTier.hasFreeTickets, true);

const paidTier = rowToEvent(
  { ...baseRow, id: 'ev-paid', attendance_mode: 'tickets' },
  null,
  [
    {
      id: 't-paid',
      event_id: 'ev-paid',
      name: 'Standard',
      ticket_type: 'Standard',
      visibility: 'public',
      price: 15,
      quantity: 20,
    },
  ]
);
assert.strictEqual(paidTier.priceKey, 'paid');
assert.ok(paidTier.price.indexOf('15') !== -1);

const membersOnly = publicPriceFromTiers([], { isMembersOnlyEvent: true });
assert.strictEqual(membersOnly.priceKey, 'free');

const unknown = publicPriceFromTiers([], { isMembersOnlyEvent: false });
assert.strictEqual(unknown.priceKey, 'enquire');
assert.strictEqual(unknown.display, 'Enquire for price');

const connected = rowToEvent(
  {
    ...baseRow,
    id: 'ev-connected',
    attendance_mode: 'tickets',
    checkout_mode: 'external_connected',
    external_booking_url: 'https://www.eventbrite.co.uk/e/123456789',
    external_price_label: '£18',
  },
  null,
  []
);
assert.strictEqual(connected.priceKey, 'paid');
assert.ok(String(connected.price).indexOf('18') !== -1);
assert.strictEqual(connected.hasTicketTiers, false);

const connectedFree = rowToEvent(
  {
    ...baseRow,
    id: 'ev-connected-free',
    attendance_mode: 'tickets',
    checkout_mode: 'external_connected',
    external_booking_url: 'https://www.eventbrite.co.uk/e/987654321',
    external_price_label: 'Free',
  },
  null,
  []
);
assert.strictEqual(connectedFree.priceKey, 'free');
assert.strictEqual(connectedFree.price, 'Free');
assert.strictEqual(connectedFree.hasFreeTickets, true);

const connectedPin = rowToBrowsePin({
  id: 'pin-connected',
  slug: 'connected-meetup',
  title: 'Connected meetup',
  city: 'Leeds',
  format_tab: 'in-person',
  starts_at: '2026-11-01T09:00:00+00:00',
  min_ticket_price: null,
  has_public_tickets: false,
  checkout_mode: 'external_connected',
  external_booking_url: 'https://www.eventbrite.co.uk/e/111',
  external_price_label: 'From £12',
  event_type: 'Meeting',
  type_tab: 'meeting',
});
assert.notStrictEqual(connectedPin.priceKey, 'enquire');
assert.ok(String(connectedPin.price).toLowerCase().indexOf('12') !== -1);

console.log('OK  unpriced listings enquire for price; Connected booking keeps its price');
