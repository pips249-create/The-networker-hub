#!/usr/bin/env node
/**
 * Listings with no public ticket must not be labelled Free.
 * Run: node scripts/test-unpriced-event-label.js
 */
const assert = require('assert');
const { rowToEvent, publicPriceFromTiers, PRICE_UNKNOWN_KEY } = require('../api/_lib/supabase-events');

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
assert.strictEqual(unpriced.price, 'Ask organiser');
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
assert.strictEqual(unknown.display, 'Ask organiser');

console.log('OK  unpriced listings ask the organiser; £0 tiers stay Free');
