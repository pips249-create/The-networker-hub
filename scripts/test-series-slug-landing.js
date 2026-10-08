#!/usr/bin/env node
/**
 * Shared series slugs should open the next date that has not started.
 * Run: node scripts/test-series-slug-landing.js
 */
const { pickSharedSeriesSlugRow } = require('../api/_lib/supabase-events');

let failed = 0;

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

const TITLE = 'Peppercorn Speed Networking';
const SHARED = 'peppercorn-speed-networking';

function row(id, startsAt, slug) {
  return {
    id,
    title: TITLE,
    slug: slug === undefined ? null : slug,
    starts_at: startsAt,
    series_group_id: 'series-1',
  };
}

const series = [
  row('sept-10', '2026-09-10T13:00:00.000Z', SHARED),
  row('sept-24', '2026-09-24T13:00:00.000Z', SHARED + '-2'),
  row('oct-1', '2026-10-01T13:00:00.000Z', null),
  row('oct-8', '2026-10-08T13:00:00.000Z', null),
  row('oct-15', '2026-10-15T13:00:00.000Z', null),
];

const beforeOct8 = new Date('2026-10-08T12:14:00.000Z');
const duringOct8 = new Date('2026-10-08T13:30:00.000Z');

const next = pickSharedSeriesSlugRow(series, SHARED, beforeOct8);
assert('shared slug lands on the next date that has not started', next && next.id === 'oct-8');

const afterStart = pickSharedSeriesSlugRow(series, SHARED, duringOct8);
assert('once that date has started, the following date is used', afterStart && afterStart.id === 'oct-15');

assert(
  'a date-specific slug stays on that date',
  pickSharedSeriesSlugRow(series, SHARED + '-2', beforeOct8) === null
);

assert(
  'a series whose shared dates have all started is left unchanged',
  pickSharedSeriesSlugRow(
    [series[0], series[2]],
    SHARED,
    beforeOct8
  ) === null
);

assert(
  'one date is not treated as a shared series slug',
  pickSharedSeriesSlugRow([series[0]], SHARED, beforeOct8) === null
);

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('all passed');
