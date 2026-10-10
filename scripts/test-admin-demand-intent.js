/**
 * Unit checks for Demand search intent rollups (no Supabase).
 * Run: node scripts/test-admin-demand-intent.js
 */
const assert = require('assert');
const {
  buildSearchIntentRollups,
  OTHER_SEARCH_MIN_COUNT,
} = require('../api/_lib/admin-demand-search-intent');

assert.strictEqual(OTHER_SEARCH_MIN_COUNT, 4);

const sample = buildSearchIntentRollups([
  {
    source: 'events_browse',
    query_text: 'business',
    location_text: '',
    region_slug: '',
    filters: {},
  },
  {
    source: 'events_browse',
    query_text: 'business',
    location_text: '',
    region_slug: '',
    filters: {},
  },
  {
    source: 'events_browse',
    query_text: 'business',
    location_text: '',
    region_slug: '',
    filters: {},
  },
  {
    source: 'events_browse',
    query_text: 'business',
    location_text: '',
    region_slug: '',
    filters: {},
  },
  {
    source: 'events_browse',
    query_text: '',
    location_text: 'Birmingham',
    region_slug: 'birmingham',
    filters: {},
  },
  {
    source: 'events_browse',
    query_text: 'essex',
    location_text: '',
    region_slug: '',
    filters: {},
  },
  {
    source: 'opportunities_browse',
    query_text: '',
    location_text: '',
    region_slug: '',
    filters: { category: 'food,tech' },
  },
  {
    source: 'opportunities_browse',
    query_text: '',
    location_text: '',
    region_slug: '',
    filters: { category: 'food' },
  },
]);

assert.ok(sample.topCities.some((r) => r.slug === 'birmingham' && r.count >= 1));
assert.ok(sample.topCounties.some((r) => r.slug === 'essex' && r.count >= 1));
assert.ok(sample.topOpportunityIndustries.some((r) => r.industry === 'food' && r.count === 2));
assert.ok(sample.topOpportunityIndustries.some((r) => r.industry === 'tech' && r.count === 1));
assert.ok(sample.otherSearchTerms.some((r) => r.term === 'business' && r.count === 4));

const noise = buildSearchIntentRollups([
  { source: 'events_browse', query_text: 'b', location_text: '', region_slug: '', filters: {} },
  { source: 'events_browse', query_text: 'b', location_text: '', region_slug: '', filters: {} },
  { source: 'events_browse', query_text: 'b', location_text: '', region_slug: '', filters: {} },
]);
assert.strictEqual(noise.otherSearchTerms.length, 0);

console.log('test-admin-demand-intent: ok');
