#!/usr/bin/env node
/**
 * Review unlock must use the same past heuristic as event pages.
 * Run: node scripts/test-event-review-ended.js
 */
const { eventHasEnded } = require('../api/_lib/supabase-reviews');
const { isEventPast } = require('../api/_lib/event-timezone');

let failed = 0;

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

const now = new Date('2026-11-19T12:00:00.000Z');
const startedYesterday = '2026-11-18T18:00:00.000Z';
const absurdSeriesEnd = '2027-03-01T18:00:00.000Z';

assert(
  'same-day ended event is finished',
  eventHasEnded(
    { starts_at: '2026-11-18T09:00:00.000Z', ends_at: '2026-11-18T11:00:00.000Z' },
    now
  ) === true
);

assert(
  'future event is not finished',
  eventHasEnded(
    { starts_at: '2026-11-20T09:00:00.000Z', ends_at: '2026-11-20T11:00:00.000Z' },
    now
  ) === false
);

assert(
  'absurd far ends_at does not block reviews after start',
  eventHasEnded({ starts_at: startedYesterday, ends_at: absurdSeriesEnd }, now) === true
);

assert(
  'naive ends_at check would still block (proves the bug)',
  new Date(absurdSeriesEnd) > now
);

assert(
  'eventHasEnded matches isEventPast for series-like ends_at',
  eventHasEnded({ starts_at: startedYesterday, ends_at: absurdSeriesEnd }, now) ===
    isEventPast({ starts_at: startedYesterday, ends_at: absurdSeriesEnd }, now)
);

assert(
  'start-only past event is finished (~2h after start)',
  eventHasEnded({ starts_at: startedYesterday, ends_at: null }, now) === true
);

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('event review ended checks passed');
