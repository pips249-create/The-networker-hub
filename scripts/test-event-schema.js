#!/usr/bin/env node
/**
 * Event JSON-LD includes the fields Google Search Console recommends.
 * Run: node scripts/test-event-schema.js
 */
const assert = require('assert');
const { buildEventSchema } = require('../api/_lib/seo-meta');
const { ticketRowToTier } = require('../api/_lib/supabase-events');

const ORIGIN = 'https://www.thenetworkeruk.com';

function baseEvent(overrides) {
  return Object.assign(
    {
      title: 'Thursday breakfast',
      slug: 'thursday-breakfast',
      description: 'Weekly networking breakfast in Manchester.',
      organiser: 'BNI Manchester',
      organiserSlug: 'bni-manchester',
      city: 'Manchester',
      venue: 'Town Hall',
      dateRaw: '2026-11-01T08:00:00.000Z',
      endDateRaw: '2026-11-01T10:00:00.000Z',
      createdAt: '2026-08-01T09:00:00.000Z',
      publishedAt: '2026-09-01T09:00:00.000Z',
      priceKey: 'paid',
      priceNum: 15,
      tickets: [],
    },
    overrides || {}
  );
}

const listed = buildEventSchema(baseEvent(), ORIGIN);
assert.strictEqual(listed.performer['@type'], 'PerformingGroup');
assert.strictEqual(listed.performer.name, 'BNI Manchester');
assert.strictEqual(
  listed.performer.url,
  'https://www.thenetworkeruk.com/organisers/bni-manchester'
);
assert.strictEqual(listed.offers['@type'], 'Offer');
assert.strictEqual(listed.offers.validFrom, '2026-09-01T09:00:00.000Z');
assert.strictEqual(listed.offers.price, 15);
console.log('ok — performer and published-date validFrom on a listed event');

const scheduled = buildEventSchema(
  baseEvent({
    ticketSalesOpensAt: '2026-10-20T09:00:00.000Z',
    isTicketSalesScheduled: true,
    salesClosedReason: 'scheduled',
    tickets: [
      {
        name: 'Standard',
        priceNum: 15,
        soldOut: false,
        saleStartsAt: '2026-09-15T09:00:00.000Z',
      },
    ],
  }),
  ORIGIN
);
assert.strictEqual(scheduled.offers.validFrom, '2026-10-20T09:00:00.000Z');
assert.strictEqual(scheduled.offers.availability, 'https://schema.org/PreOrder');
console.log('ok — scheduled public open wins over an earlier tier sale start');

const staggered = buildEventSchema(
  baseEvent({
    ticketSalesOpensAt: '2026-10-01T09:00:00.000Z',
    isTicketSalesScheduled: true,
    salesClosedReason: 'scheduled',
    tickets: [
      { name: 'Early bird', priceNum: 10, soldOut: false, saleStartsAt: '2026-10-01T09:00:00.000Z' },
      { name: 'Standard', priceNum: 15, soldOut: false, saleStartsAt: '2026-10-20T09:00:00.000Z' },
    ],
  }),
  ORIGIN
);
assert.strictEqual(staggered.offers[0].validFrom, '2026-10-01T09:00:00.000Z');
assert.strictEqual(staggered.offers[1].validFrom, '2026-10-20T09:00:00.000Z');
console.log('ok — a later ticket tier keeps its own sale start');

const onSale = buildEventSchema(
  baseEvent({
    tickets: [
      { name: 'Early bird', priceNum: 10, soldOut: false, saleStartsAt: '2026-09-10T08:00:00.000Z' },
      { name: 'Standard', priceNum: 15, soldOut: true },
    ],
  }),
  ORIGIN
);
assert.ok(Array.isArray(onSale.offers));
assert.strictEqual(onSale.offers[0].validFrom, '2026-09-10T08:00:00.000Z');
assert.strictEqual(onSale.offers[1].validFrom, '2026-09-01T09:00:00.000Z');
console.log('ok — each ticket offer gets its own validFrom');

const createdOnly = buildEventSchema(
  baseEvent({
    publishedAt: null,
    tickets: [{ name: 'Standard', priceNum: 0, soldOut: false }],
  }),
  ORIGIN
);
assert.strictEqual(createdOnly.offers.validFrom, '2026-08-01T09:00:00.000Z');
assert.strictEqual(createdOnly.offers.price, 0);
console.log('ok — createdAt fills validFrom when the listing was never stamped published');

const enquire = buildEventSchema(baseEvent({ priceKey: 'enquire', priceNum: null }), ORIGIN);
assert.strictEqual(enquire.offers, undefined);
assert.strictEqual(enquire.performer.name, 'BNI Manchester');
console.log('ok — enquire listings stay without an offer and still name the performer');

const unnamed = buildEventSchema(baseEvent({ organiser: '', organiserSlug: '' }), ORIGIN);
assert.strictEqual(unnamed.performer, undefined);
assert.strictEqual(unnamed.organizer, undefined);
console.log('ok — no performer is invented when the event has no organiser');

const tier = ticketRowToTier(
  {
    id: 't1',
    name: 'Standard',
    price: 12,
    sale_starts_at: '2026-09-10T08:00:00.000Z',
    sale_ends_at: '2026-11-01T08:00:00.000Z',
  },
  0
);
assert.strictEqual(tier.saleStartsAt, '2026-09-10T08:00:00.000Z');
console.log('ok — public ticket tiers keep sale_starts_at for offer validFrom');

console.log('All event schema checks passed');
