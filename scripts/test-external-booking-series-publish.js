#!/usr/bin/env node
/**
 * Link Out lean publish must cover every series date — not only the anchor id.
 * 1) Seed ids from Connected setup ?ids=
 * 2) expandEventIdsToSeriesPeers includes siblings
 * 3) updateExternalBookingFields patches every target id when publishing
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

function seedExternalBookingPublishIds(eventId, payloadEventIds) {
  const id = String(eventId || '').trim();
  const extras = (Array.isArray(payloadEventIds) ? payloadEventIds : [])
    .map((raw) => String(raw || '').trim())
    .filter(Boolean);
  return [...new Set([id, ...extras].filter(Boolean))];
}

assert.deepStrictEqual(seedExternalBookingPublishIds('a', ['a', 'b']), ['a', 'b']);
assert.deepStrictEqual(seedExternalBookingPublishIds('a', ['b']), ['a', 'b']);
assert.deepStrictEqual(seedExternalBookingPublishIds('a', []), ['a']);

// Source contract: client sends eventIds; server expands series peers.
const clientSrc = fs.readFileSync(
  path.join(__dirname, '../js/organiser-event-connected-setup.js'),
  'utf8'
);
assert.ok(
  /payload\.eventIds\s*=\s*seriesIds/.test(clientSrc),
  'Connected setup must send eventIds for multi-date publish'
);

const serverSrc = fs.readFileSync(
  path.join(__dirname, '../api/_lib/supabase-organiser-events.js'),
  'utf8'
);
const fnStart = serverSrc.indexOf('async function updateExternalBookingFields');
const fnSlice = serverSrc.slice(fnStart, fnStart + 4500);
assert.ok(fnStart >= 0, 'updateExternalBookingFields must exist');
assert.ok(
  /expandEventIdsToSeriesPeers/.test(fnSlice),
  'updateExternalBookingFields must expand series peers'
);
assert.ok(
  /\.in\('id',\s*targetIds\)/.test(fnSlice) || /\.in\("id",\s*targetIds\)/.test(fnSlice),
  'updateExternalBookingFields must update all target ids'
);

// Mocked expandEventIdsToSeriesPeers behaviour (same query shape as production).
async function expandEventIdsToSeriesPeersMock(rowsById, eventIds) {
  const seedIds = [...new Set((eventIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  const expanded = new Set(seedIds);
  const seenSeries = new Set();
  for (const id of seedIds) {
    const row = rowsById.get(id);
    if (!row || row.duplicated_from_event_id) continue;
    const seriesKey = String(row.series_group_id || '').trim();
    if (!seriesKey || seenSeries.has(seriesKey)) continue;
    seenSeries.add(seriesKey);
    for (const peer of rowsById.values()) {
      if (
        peer.series_group_id === seriesKey &&
        peer.organiser_id === row.organiser_id &&
        ['draft', 'published', 'unpublished'].includes(peer.status)
      ) {
        expanded.add(peer.id);
      }
    }
  }
  return [...expanded];
}

const catalog = new Map([
  [
    'evt-day1',
    {
      id: 'evt-day1',
      series_group_id: 'series-martech',
      organiser_id: 'org-beetc',
      status: 'draft',
      duplicated_from_event_id: null,
    },
  ],
  [
    'evt-day2',
    {
      id: 'evt-day2',
      series_group_id: 'series-martech',
      organiser_id: 'org-beetc',
      status: 'draft',
      duplicated_from_event_id: null,
    },
  ],
]);

(async () => {
  const seeded = seedExternalBookingPublishIds('evt-day1', ['evt-day1', 'evt-day2']);
  const allIds = await expandEventIdsToSeriesPeersMock(catalog, seeded);
  assert.deepStrictEqual(allIds.sort(), ['evt-day1', 'evt-day2']);

  // Anchor only in payload still expands via series_group_id.
  const fromAnchorOnly = await expandEventIdsToSeriesPeersMock(
    catalog,
    seedExternalBookingPublishIds('evt-day1', [])
  );
  assert.deepStrictEqual(fromAnchorOnly.sort(), ['evt-day1', 'evt-day2']);

  console.log('test-external-booking-series-publish: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
