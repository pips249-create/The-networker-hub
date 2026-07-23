#!/usr/bin/env node
/**
 * Live lookup must beat static pattern matches (e.g. "events in Ripon?").
 * Usage: node scripts/test-hubert-live-fallback.js
 */
const { pickLiveFallbackReply } = require('../api/_lib/hubert-reply');

const cases = [
  {
    name: 'Manchester empty search gives honest no-results',
    text: 'What events are in Manchester?',
    eventLookup: {
      events: [],
      query: { text: 'What events are in Manchester?', location: 'manchester', configured: true },
    },
    opportunityLookup: null,
    expect: /couldn't find upcoming events in Manchester|I'm afraid there aren't any upcoming events|checked our live listings/i,
    reject: /try "What events are in Manchester/i,
  },
  {
    name: 'Ripon empty search beats generic prompt',
    text: 'what events are in Ripon?',
    eventLookup: { events: [], query: { text: 'what events are in Ripon?', location: 'ripon', configured: true } },
    opportunityLookup: null,
    expect: /couldn't find upcoming events in Ripon|I'm afraid there aren't any upcoming events|checked our live listings/i,
    reject: /try "What events are in Manchester/i,
  },
  {
    name: 'Ripon with results lists events',
    text: 'what events are in Ripon?',
    eventLookup: {
      events: [
        {
          title: 'Ripon breakfast networking',
          dateLine: 'Fri 8am',
          city: 'Ripon',
          price: 'Free',
          slug: 'ripon-breakfast',
        },
      ],
      query: { text: 'what events are in Ripon?', location: 'ripon', configured: true },
    },
    opportunityLookup: null,
    expect: /Ripon breakfast networking.*\/events\/ripon-breakfast/is,
  },
  {
    name: 'Static fallback when no live search ran',
    text: 'How do I find events on the hub?',
    eventLookup: null,
    opportunityLookup: null,
    expect: /Browse all events.*\/events\//is,
  },
  {
    name: 'Payout question uses knowledge not empty event search',
    text: 'When do I get paid for ticket sales?',
    eventLookup: null,
    opportunityLookup: null,
    expect: /Stripe Connect|Stripe Express|\/help\/organiser-payouts/i,
  },
  {
    name: 'Franchise browse empty results beat generic opportunity fallback',
    text: 'What franchise opportunities are on the hub?',
    eventLookup: null,
    opportunityLookup: {
      opportunities: [],
      query: { text: 'What franchise opportunities are on the hub?', types: ['franchise'], configured: true },
    },
    expect: /I'm afraid I couldn't find published business opportunities|Allow me to highlight/i,
    reject: /Browse free at \/opportunities\/.*To enquire, create a free account and send a message/i,
  },
  {
    name: 'Franchise browse with results lists opportunities',
    text: 'What franchise opportunities are on the hub?',
    eventLookup: null,
    opportunityLookup: {
      opportunities: [
        {
          title: 'Coffee franchise UK',
          type: 'franchise',
          host: 'Bean Co',
          desc: 'Low investment coffee shop franchise.',
          id: 'coffee-franchise-uk',
        },
      ],
      query: { text: 'What franchise opportunities are on the hub?', types: ['franchise'], configured: true },
    },
    expect: /Coffee franchise UK.*\/opportunities\/coffee-franchise-uk/is,
  },
  {
    name: 'List opportunity question uses organiser fallback not live browse',
    text: 'How do I list a business opportunity on the hub?',
    eventLookup: null,
    opportunityLookup: null,
    expect: /\/organiser\/.*Business opportunities|\/guides\/list-a-business-opportunity/i,
  },
];

let failed = 0;

cases.forEach(function (item) {
  const reply = pickLiveFallbackReply(item.eventLookup, item.opportunityLookup, item.text);
  const ok = item.expect.test(reply);
  const bad = item.reject && item.reject.test(reply);
  if (!ok || bad) {
    failed++;
    console.log('FAIL:', item.name);
    console.log('  Got:', reply.slice(0, 180) + (reply.length > 180 ? '...' : ''));
    console.log('');
  }
});

console.log(
  failed
    ? failed + ' of ' + cases.length + ' live-fallback checks failed'
    : 'All ' + cases.length + ' live-fallback checks passed'
);
process.exit(failed ? 1 : 0);
