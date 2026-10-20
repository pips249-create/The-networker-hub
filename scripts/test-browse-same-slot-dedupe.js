#!/usr/bin/env node
/**
 * Unit checks for collapsing accidental same-slot event republishes on browse.
 * Run: node scripts/test-browse-same-slot-dedupe.js
 */
const {
  collapseBrowseSameSlotDuplicates,
  dedupeBrowseRowsBySeries,
  browseSameSlotQuality,
} = require('../api/_lib/event-series-peers');

let failed = 0;

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

const starts = '2026-11-20T11:00:00+00:00';
const organiser = 'org-fcc';

const enquireA = {
  id: 'enquire-a',
  organiser_id: organiser,
  title: 'Glasgow Networking Events for Founders | Founders Coffee Club',
  starts_at: starts,
  min_ticket_price: null,
  checkout_mode: 'hub',
  image_url: '',
};

const enquireB = {
  id: 'enquire-b',
  organiser_id: organiser,
  title: 'Glasgow Networking Events for Founders | Founders Coffee Club',
  starts_at: starts,
  min_ticket_price: null,
  checkout_mode: 'hub',
  image_url: 'https://cdn.example/photo.jpg',
};

const priced = {
  id: 'priced',
  organiser_id: organiser,
  title: 'Glasgow Networking Events for Founders | Founders Coffee Club',
  starts_at: starts,
  min_ticket_price: 15,
  checkout_mode: 'external_link',
  external_booking_url: 'https://www.eventbrite.com/checkout-external?eid=1',
  image_url: 'https://cdn.example/photo.jpg',
};

const december = {
  id: 'dec',
  organiser_id: organiser,
  title: 'Glasgow Networking Events for Founders | Founders Coffee Club (December)',
  starts_at: '2026-12-18T11:00:00+00:00',
  min_ticket_price: 15,
  checkout_mode: 'external_link',
  external_booking_url: 'https://www.eventbrite.com/checkout-external?eid=2',
};

const otherOrg = {
  id: 'other',
  organiser_id: 'org-other',
  title: 'Glasgow Networking Events for Founders | Founders Coffee Club',
  starts_at: starts,
  min_ticket_price: null,
  checkout_mode: 'hub',
};

assert(
  'priced listing outranks enquire clones',
  browseSameSlotQuality(priced) > browseSameSlotQuality(enquireB) &&
    browseSameSlotQuality(enquireB) > browseSameSlotQuality(enquireA)
);

const collapsed = collapseBrowseSameSlotDuplicates([enquireA, priced, enquireB, december, otherOrg]);
assert('collapses three same-slot rows to one', collapsed.length === 3);
assert('keeps the priced Eventbrite listing', collapsed[0] && collapsed[0].id === 'priced');
assert('keeps a different date/title', collapsed.some((r) => r.id === 'dec'));
assert('keeps another organiser on the same slot', collapsed.some((r) => r.id === 'other'));

const seriesPeers = [
  {
    id: 's1',
    organiser_id: organiser,
    title: 'Monthly Meetup',
    starts_at: '2026-11-01T09:00:00+00:00',
    series_group_id: 'sg1',
    min_ticket_price: 10,
  },
  {
    id: 's2',
    organiser_id: organiser,
    title: 'Monthly Meetup',
    starts_at: '2026-12-01T09:00:00+00:00',
    series_group_id: 'sg1',
    min_ticket_price: 10,
  },
];
const seriesDeduped = dedupeBrowseRowsBySeries(seriesPeers);
assert('series still collapses to one card across dates', seriesDeduped.length === 1);
assert('series keeps the first upcoming date', seriesDeduped[0].id === 's1');

const mixed = dedupeBrowseRowsBySeries([enquireA, enquireB, priced, seriesPeers[0], seriesPeers[1]]);
assert('same-slot + series both apply', mixed.length === 2);
assert(
  'mixed keeps priced same-slot and first series date',
  mixed.some((r) => r.id === 'priced') && mixed.some((r) => r.id === 's1')
);

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll browse same-slot dedupe checks passed.');
