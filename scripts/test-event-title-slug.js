#!/usr/bin/env node
/**
 * Cards link to /events/{title-slug} when events.slug is empty.
 * That lookup must find the next published date without scanning the catalogue.
 *
 * Run: node scripts/test-event-title-slug.js
 */
const {
  fetchPublishedEventBySlug,
  titleIlikePatternFromSlug,
  pickUpcomingSlugMatch,
} = require('../api/_lib/supabase-events');

let failed = 0;

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

function createMockSb(handlers) {
  return {
    from(table) {
      const state = {
        table,
        filters: [],
        single: null,
      };
      const b = {
        select() {
          return b;
        },
        eq(col, val) {
          state.filters.push(['eq', col, val]);
          return b;
        },
        not(col, op, val) {
          state.filters.push(['not', col, op, val]);
          return b;
        },
        ilike(col, val) {
          state.filters.push(['ilike', col, val]);
          return b;
        },
        gte(col, val) {
          state.filters.push(['gte', col, val]);
          return b;
        },
        lt(col, val) {
          state.filters.push(['lt', col, val]);
          return b;
        },
        order() {
          return b;
        },
        limit() {
          return b;
        },
        maybeSingle() {
          state.single = 'maybe';
          return Promise.resolve(handlers(state));
        },
        then(resolve, reject) {
          return Promise.resolve(handlers(state)).then(resolve, reject);
        },
      };
      return b;
    },
  };
}

function row(id, startsAt, extra) {
  return {
    id,
    slug: null,
    title: 'Faith Works - Christian Business Networking',
    approval_status: 'Approved',
    status: 'published',
    starts_at: startsAt,
    series_group_id: 'series-faith',
    ...extra,
  };
}

async function testTitleSlugLandsOnNextDate() {
  const soon = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  const later = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString();
  let catalogueScans = 0;
  let pastLookups = 0;
  const sb = createMockSb((state) => {
    if (state.table === 'published_events') {
      catalogueScans += 1;
      return { data: [], error: null };
    }
    if (state.single === 'maybe') return { data: null, error: null };
    const titleLike = state.filters.some((f) => f[0] === 'ilike' && f[1] === 'title');
    const slugLike = state.filters.some((f) => f[0] === 'ilike' && f[1] === 'slug');
    if (slugLike) return { data: [], error: null };
    if (titleLike && state.filters.some((f) => f[0] === 'lt')) {
      pastLookups += 1;
      return { data: [], error: null };
    }
    if (titleLike) {
      return { data: [row('oct', soon), row('dec', later)], error: null };
    }
    return { data: null, error: null };
  });

  const found = await fetchPublishedEventBySlug(
    sb,
    'faith-works-christian-business-networking'
  );
  assert('null slug resolves to the next date', found && found.id === 'oct');
  assert('does not scan published_events', catalogueScans === 0);
  assert('does not need the past-date fallback', pastLookups === 0);
}

function testPatternAndPick() {
  assert(
    'title pattern keeps each word',
    titleIlikePatternFromSlug('faith-works-christian-business-networking') ===
      '%faith%works%christian%business%networking%'
  );
  const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const later = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
  const picked = pickUpcomingSlugMatch(
    [row('later', later), row('soon', soon)],
    'faith-works-christian-business-networking'
  );
  assert('picker chooses the soonest date that has not started', picked && picked.id === 'soon');
}

async function main() {
  testPatternAndPick();
  await testTitleSlugLandsOnNextDate();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('all passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
