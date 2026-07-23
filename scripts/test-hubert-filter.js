#!/usr/bin/env node
/**
 * Hubert event/opportunity scoring must respect location and type filters.
 * Usage: node scripts/test-hubert-filter.js
 */
const { scoreEvent, eventHaystack } = require('../api/_lib/hubert-events');
const { scoreOpportunity } = require('../api/_lib/hubert-opportunities');
const { formatEventFallbackReply } = require('../api/_lib/hubert-events');
const { formatOpportunityFallbackReply } = require('../api/_lib/hubert-opportunities');

const future = Date.now() + 7 * 24 * 60 * 60 * 1000;

const manchesterEvent = {
  title: 'Manchester breakfast networking',
  city: 'Manchester',
  location: 'King Street, Manchester',
  slug: 'manchester-breakfast',
  price: '£15',
  priceKey: 'paid',
  nextDateTs: future,
  dateLine: 'Fri 7:30am',
};

const londonEvent = {
  title: 'London tech meetup',
  city: 'London',
  location: 'Shoreditch, London',
  slug: 'london-tech',
  price: 'Free',
  priceKey: 'free',
  nextDateTs: future,
  dateLine: 'Thu 6pm',
};

let failed = 0;

function assert(name, ok, detail) {
  if (!ok) {
    failed++;
    console.log('FAIL:', name, detail || '');
  }
}

assert(
  'Manchester query matches Manchester event',
  scoreEvent(manchesterEvent, { text: 'events in Manchester', location: 'manchester', window: {}, freeOnly: false }) > 0
);
assert(
  'Manchester query rejects London event',
  scoreEvent(londonEvent, { text: 'events in Manchester', location: 'manchester', window: {}, freeOnly: false }) < 0
);
assert(
  'Free-only query rejects paid event',
  scoreEvent(manchesterEvent, { text: 'free events', location: '', window: {}, freeOnly: true }) < 0
);
assert(
  'Free-only query accepts free event',
  scoreEvent(londonEvent, { text: 'free events', location: '', window: {}, freeOnly: true }) > 0
);

const franchiseItem = {
  title: 'Coffee franchise UK',
  type: 'franchise',
  host: 'Bean Co',
  desc: 'Low investment coffee shop franchise.',
  id: 'coffee-franchise-uk',
};

const partnershipItem = {
  title: 'Marketing partnership',
  type: 'partnership',
  host: 'Agency Co',
  desc: 'Referral partnership for agencies.',
  id: 'marketing-partnership',
};

assert(
  'Franchise query matches franchise listing',
  scoreOpportunity(franchiseItem, { text: 'franchise opportunities', types: ['franchise'], featuredOnly: false }) > 0
);
assert(
  'Franchise query rejects partnership listing',
  scoreOpportunity(partnershipItem, { text: 'franchise opportunities', types: ['franchise'], featuredOnly: false }) < 0
);

const eventReply = formatEventFallbackReply({
  events: [manchesterEvent],
  query: { location: 'manchester' },
});
assert('Event fallback includes full URL', /https?:\/\/.*\/events\/manchester-breakfast/.test(eventReply), eventReply);

const oppReply = formatOpportunityFallbackReply({
  opportunities: [franchiseItem],
  query: { types: ['franchise'] },
});
assert(
  'Opportunity fallback includes full URL',
  /https?:\/\/.*\/opportunities\/coffee-franchise-uk/.test(oppReply),
  oppReply
);

assert('eventHaystack includes city', eventHaystack(manchesterEvent).includes('manchester'));

console.log(
  failed ? failed + ' filter checks failed' : 'All Hubert filter checks passed'
);
process.exit(failed ? 1 : 0);
