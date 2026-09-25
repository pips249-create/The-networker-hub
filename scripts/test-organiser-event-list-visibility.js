#!/usr/bin/env node
/**
 * My Events keeps an event that ended yesterday visible, and still finds
 * older archived events via search or the Archived status.
 */
const assert = require('assert');
const vis = require('../js/organiser-event-list-visibility');

const NOW = Date.parse('2026-09-25T11:00:00.000Z');

function eventOn(iso, extra) {
  return Object.assign({ id: iso, title: "Pip's Test", statusKey: 'archived', date: iso }, extra || {});
}

function hidden(ev, overrides) {
  return vis.shouldHideArchivedRow(
    Object.assign(
      {
        hideArchived: true,
        status: 'all',
        search: '',
        isArchived: true,
        event: ev,
        nowMs: NOW,
      },
      overrides || {}
    )
  );
}

const yesterday = eventOn('2026-09-24T18:00:00.000Z');
assert.strictEqual(vis.eventEndedRecently(yesterday, NOW), true);
assert.strictEqual(hidden(yesterday), false, 'yesterday stays on the list');

const twoWeeks = eventOn('2026-09-11T11:00:00.000Z');
assert.strictEqual(vis.eventEndedRecently(twoWeeks, NOW), true, 'exactly 14 days still counts as recent');
assert.strictEqual(hidden(twoWeeks), false);

const older = eventOn('2026-08-01T18:00:00.000Z');
assert.strictEqual(hidden(older), true, 'older archived events stay hidden by default');
assert.strictEqual(hidden(older, { search: "pip's" }), false, 'search shows older archived events');
assert.strictEqual(hidden(older, { status: 'archived' }), false, 'Archived status shows older events');
assert.strictEqual(hidden(older, { hideArchived: false }), false, 'unchecking Hide archived shows them');
assert.strictEqual(hidden(older, { isArchived: false }), false, 'live rows are not archive-hidden');

const upcoming = eventOn('2026-10-02T18:00:00.000Z', { statusKey: 'upcoming' });
assert.strictEqual(hidden(upcoming, { isArchived: false }), false);

const longEnd = eventOn('2026-09-24T09:00:00.000Z', {
  endDate: '2027-01-01T09:00:00.000Z',
});
assert.strictEqual(
  vis.eventEndedRecently(longEnd, NOW),
  true,
  'a far ends_at uses the start, so yesterday still counts'
);

const series = {
  isSeries: true,
  seriesEvents: [older, yesterday],
};
assert.strictEqual(vis.eventEndedRecently(series, NOW), true);
assert.strictEqual(hidden(series), false, 'a series with a recent date stays visible');

const oldSeries = { isSeries: true, seriesEvents: [older, eventOn('2026-07-01T12:00:00.000Z')] };
assert.strictEqual(hidden(oldSeries), true);

console.log('test-organiser-event-list-visibility: ok');
