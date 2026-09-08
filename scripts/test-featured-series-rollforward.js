#!/usr/bin/env node
/**
 * Unit checks for Premium Spotlight series roll-forward.
 * Run: node scripts/test-featured-series-rollforward.js
 */
const {
  isFeaturedPlacementUnexpired,
  isEventCurrentlyFeatured,
  planSeriesFeaturedRollForward,
} = require('../api/_lib/event-featured-plans');

let failed = 0;

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

const now = new Date('2026-09-08T12:00:00.000Z');
const pastStart = '2026-09-01T18:00:00.000Z';
const nextStart = '2026-09-15T18:00:00.000Z';
const laterStart = '2026-10-01T18:00:00.000Z';
const until = '2026-09-30T23:59:59.000Z';
const expiredUntil = '2026-09-01T00:00:00.000Z';

const startedFeatured = {
  id: 'a',
  title: 'Monthly Meetup',
  status: 'published',
  approval_status: 'Approved',
  starts_at: pastStart,
  featured: true,
  featured_until: until,
  featured_plan: '1month',
  featured_paid_at: '2026-08-20T00:00:00.000Z',
  featured_amount_gbp: 55,
  series_group_id: 'sg1',
};

const upcomingNotFeatured = {
  id: 'b',
  title: 'Monthly Meetup',
  status: 'published',
  approval_status: 'Approved',
  starts_at: nextStart,
  featured: false,
  featured_until: null,
  series_group_id: 'sg1',
};

const upcomingLater = {
  id: 'c',
  title: 'Monthly Meetup',
  status: 'published',
  approval_status: 'Approved',
  starts_at: laterStart,
  featured: false,
  featured_until: null,
  series_group_id: 'sg1',
};

assert(
  'unexpired ignores started',
  isFeaturedPlacementUnexpired(startedFeatured, now) === true
);
assert(
  'currently featured false once started',
  isEventCurrentlyFeatured(startedFeatured, now) === false
);
assert(
  'expired placement is inactive',
  isFeaturedPlacementUnexpired({ ...startedFeatured, featured_until: expiredUntil }, now) === false
);

const plan = planSeriesFeaturedRollForward(
  [startedFeatured, upcomingNotFeatured, upcomingLater],
  now
);
assert('roll-forward plans upcoming peers', !!plan);
assert('features both upcoming ids', plan.featureIds.sort().join(',') === 'b,c');
assert('copies featured_until', plan.patch.featured_until === until);
assert('copies paid metadata', plan.patch.featured_amount_gbp === 55);

const alreadySynced = planSeriesFeaturedRollForward(
  [
    startedFeatured,
    { ...upcomingNotFeatured, featured: true, featured_until: until, featured_plan: '1month', featured_paid_at: startedFeatured.featured_paid_at, featured_amount_gbp: 55 },
    { ...upcomingLater, featured: true, featured_until: until, featured_plan: '1month', featured_paid_at: startedFeatured.featured_paid_at, featured_amount_gbp: 55 },
  ],
  now
);
assert('no-op when upcoming already featured', alreadySynced == null);

const cleared = planSeriesFeaturedRollForward(
  [
    { ...startedFeatured, featured: false, featured_until: null },
    upcomingNotFeatured,
    upcomingLater,
  ],
  now
);
assert('does not resurrect cleared series', cleared == null);

const expiredSeries = planSeriesFeaturedRollForward(
  [
    { ...startedFeatured, featured_until: expiredUntil },
    upcomingNotFeatured,
  ],
  now
);
assert('does not roll expired placements', expiredSeries == null);

const noUpcoming = planSeriesFeaturedRollForward([startedFeatured], now);
assert('no-op without upcoming browse peers', noUpcoming == null);

const openEnded = planSeriesFeaturedRollForward(
  [
    { ...startedFeatured, featured_until: null },
    upcomingNotFeatured,
  ],
  now
);
assert('rolls open-ended admin placements', !!openEnded && openEnded.featureIds.includes('b'));

if (failed) {
  console.error('\n' + failed + ' assertion(s) failed');
  process.exit(1);
}
console.log('\nAll featured series roll-forward checks passed.');
