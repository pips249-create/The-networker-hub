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
const { takeFirstRowPerSeries } = require('../api/_lib/event-series-peers');

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
assert('roll-forward plans the next date only', !!plan);
assert('features the next upcoming id', plan.featureIds.join(',') === 'b');
assert('clears the started date', plan.clearIds.indexOf('a') !== -1);
assert('does not feature later dates yet', plan.featureIds.indexOf('c') === -1);
assert('copies featured_until', plan.patch.featured_until === until);
assert('copies paid metadata', plan.patch.featured_amount_gbp === 55);

const alreadySynced = planSeriesFeaturedRollForward(
  [
    { ...startedFeatured, featured: false, featured_until: null },
    { ...upcomingNotFeatured, featured: true, featured_until: until, featured_plan: '1month', featured_paid_at: startedFeatured.featured_paid_at, featured_amount_gbp: 55 },
    upcomingLater,
  ],
  now
);
assert('no-op when the next date is already the only featured row', alreadySynced == null);

const collapseExtras = planSeriesFeaturedRollForward(
  [
    startedFeatured,
    { ...upcomingNotFeatured, featured: true, featured_until: until, featured_plan: '1month', featured_paid_at: startedFeatured.featured_paid_at, featured_amount_gbp: 55 },
    { ...upcomingLater, featured: true, featured_until: until, featured_plan: '1month', featured_paid_at: startedFeatured.featured_paid_at, featured_amount_gbp: 55 },
  ],
  now
);
assert('collapses a series down to the next date', !!collapseExtras);
assert('keeps the soonest upcoming date', collapseExtras.featureIds.length === 0 && collapseExtras.keeperId === 'b');
assert(
  'clears the other dates',
  collapseExtras.clearIds.slice().sort().join(',') === 'a,c'
);

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
assert('open-ended roll clears the started date', openEnded.clearIds.indexOf('a') !== -1);

const laterDateOnly = planSeriesFeaturedRollForward(
  [
    upcomingNotFeatured,
    {
      ...upcomingLater,
      featured: true,
      featured_until: until,
      featured_plan: '1month',
      featured_paid_at: startedFeatured.featured_paid_at,
      featured_amount_gbp: 55,
    },
  ],
  now
);
assert(
  'keeps the date that was actually featured',
  laterDateOnly == null || laterDateOnly.keeperId === 'c'
);

const siblings = [];
for (let i = 0; i < 40; i++) {
  siblings.push({
    id: 's' + i,
    series_group_id: 'long',
    starts_at: '2026-09-' + String(10 + (i % 20)).padStart(2, '0') + 'T18:00:00.000Z',
    featured: true,
  });
}
siblings.push({
  id: 'other',
  series_group_id: 'other',
  starts_at: '2026-12-01T18:00:00.000Z',
  featured: true,
});
const picked = takeFirstRowPerSeries(siblings, 12);
assert('series siblings do not fill the spotlight window', picked.rows.length === 2);
assert('spotlight keeps the next date of each series', picked.rows[0].id === 's0' && picked.rows[1].id === 'other');

if (failed) {
  console.error('\n' + failed + ' assertion(s) failed');
  process.exit(1);
}
console.log('\nAll featured series roll-forward checks passed.');
