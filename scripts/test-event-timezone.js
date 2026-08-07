#!/usr/bin/env node
/**
 * UK wall-clock parsing for multi-date series (BST/GMT).
 * Run: node scripts/test-event-timezone.js
 */
const {
  londonWallToUtcIso,
  parseEventDateInputToUtcIso,
  formatTime,
} = require('../api/_lib/event-timezone');

let failed = 0;

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

const sept = parseEventDateInputToUtcIso('2025-09-03T10:15:00');
const oct = parseEventDateInputToUtcIso('2025-10-14T10:15');
const nov = parseEventDateInputToUtcIso('2025-11-17T10:15:00');

assert('Sept bare datetime → 09:15Z (BST)', sept === '2025-09-03T09:15:00.000Z');
assert('Oct bare datetime → 09:15Z (BST)', oct === '2025-10-14T09:15:00.000Z');
assert('Nov bare datetime → 10:15Z (GMT)', nov === '2025-11-17T10:15:00.000Z');
assert('Sept displays 10:15 London', formatTime(sept) === '10:15');
assert('Oct displays 10:15 London', formatTime(oct) === '10:15');
assert('Nov displays 10:15 London', formatTime(nov) === '10:15');

assert(
  'Absolute ISO with Z is preserved',
  parseEventDateInputToUtcIso('2025-11-17T09:15:00.000Z') === '2025-11-17T09:15:00.000Z'
);

assert(
  'londonWallToUtcIso matches parser for Nov',
  londonWallToUtcIso(2025, 11, 17, 10, 15) === nov
);

const {
  formatEventDateTime,
  formatDateTimeLong,
} = require('../api/_lib/event-timezone');

const bstInstant = '2025-09-03T09:15:00.000Z';
const gmtInstant = '2025-11-17T10:15:00.000Z';
assert(
  'formatEventDateTime BST time is 10:15',
  formatEventDateTime(bstInstant).event_time === '10:15'
);
assert(
  'formatEventDateTime GMT time is 10:15',
  formatEventDateTime(gmtInstant).event_time === '10:15'
);
assert(
  'formatDateTimeLong includes at 10:15 for BST',
  formatDateTimeLong(bstInstant).includes('at 10:15')
);

// Simulate UTC-server bug: same UTC hour on every date
const sameUtcNov = '2025-11-17T09:15:00.000Z';
assert('Wrong same-UTC Nov would show 09:15', formatTime(sameUtcNov) === '09:15');

assert(
  'UTC host still formats booking email times in London',
  (() => {
    const prev = process.env.TZ;
    process.env.TZ = 'UTC';
    // Intl uses system TZ for some engines only at process start; formatTime always passes timeZone.
    const ok = formatTime(bstInstant) === '10:15' && formatTime(gmtInstant) === '10:15';
    if (prev == null) delete process.env.TZ;
    else process.env.TZ = prev;
    return ok;
  })()
);

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll checks passed');
