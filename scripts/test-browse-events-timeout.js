#!/usr/bin/env node
/**
 * The public events page 504'd because page 1 scanned the upcoming catalogue
 * twice (grid + type chips) inside a 15s function limit. These checks lock
 * the single shared scan.
 *
 * Run: node scripts/test-browse-events-timeout.js
 */
const {
  fetchBrowseEventsPage,
  clearBrowseCatalogueCache,
  BROWSE_VIEW,
  BROWSE_SLIM_SELECT,
} = require('../api/_lib/browse-events-query');
const slots = require('../api/_lib/event-featured-slots');

slots.getFeaturedSpotlightSlotStatus = async function () {
  return { max: 12, used: 0, available: 12, full: false };
};

let failed = 0;

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

function futureIso(days) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

function eventRow(id, extra) {
  return Object.assign(
    {
      id: id,
      title: 'Event ' + id,
      slug: 'event-' + id,
      event_type: 'Meeting',
      type_tab: 'meeting',
      series_group_id: null,
      organiser_id: null,
      starts_at: futureIso(3),
      ends_at: futureIso(3),
      featured: false,
      featured_until: null,
      approval_status: 'Approved',
      status: 'published',
      format_tab: 'in-person',
      min_ticket_price: 0,
      average_rating: 4,
      review_count: 1,
      image_position: 'center',
      attendance_mode: 'tickets',
      created_at: futureIso(-2),
      city: 'Manchester',
    },
    extra || {}
  );
}

function createMockSb(allRows) {
  const calls = [];
  function from(table) {
    const state = { table: table, select: null, range: null, limit: null, filters: [] };
    const b = {
      select(cols) {
        state.select = cols;
        return b;
      },
      order() {
        return b;
      },
      range(start, end) {
        state.range = [start, end];
        return b;
      },
      limit(n) {
        state.limit = n;
        return b;
      },
      eq(col, val) {
        state.filters.push(['eq', col, val]);
        return b;
      },
      gt() {
        return b;
      },
      gte() {
        return b;
      },
      lte() {
        return b;
      },
      in(col, vals) {
        state.filters.push(['in', col, vals]);
        return b;
      },
      or() {
        return b;
      },
      neq() {
        return b;
      },
      then(resolve, reject) {
        try {
          calls.push({
            table: state.table,
            select: state.select,
            range: state.range ? state.range.slice() : null,
            limit: state.limit,
            filters: state.filters.slice(),
          });
          let data = [];
          if (table === BROWSE_VIEW || table === 'browse_events_index') {
            data = allRows.slice();
            state.filters.forEach((filter) => {
              if (filter[0] === 'in' && filter[1] === 'id') {
                const ids = new Set(filter[2]);
                data = data.filter((row) => ids.has(row.id));
              }
              if (filter[0] === 'eq' && filter[1] === 'featured') {
                data = data.filter((row) => !!row.featured === !!filter[2]);
              }
            });
            if (state.range) data = data.slice(state.range[0], state.range[1] + 1);
            if (state.limit) data = data.slice(0, state.limit);
          }
          resolve({ data: data, error: null });
        } catch (err) {
          reject(err);
        }
      },
    };
    return b;
  }
  return { from: from, calls: calls };
}

function slimScanCount(sb) {
  return sb.calls.filter((call) => {
    return call.table === BROWSE_VIEW && call.select === BROWSE_SLIM_SELECT && call.range;
  }).length;
}

async function testSmallCatalogue() {
  clearBrowseCatalogueCache();
  const rows = [
    eventRow('a', { title: 'Alpha meetup', average_rating: 5 }),
    eventRow('b', {
      title: 'Beta webinar',
      event_type: 'Webinar',
      type_tab: 'webinar',
      series_group_id: 'series-beta',
      starts_at: futureIso(4),
    }),
    eventRow('c', {
      title: 'Beta webinar',
      event_type: 'Webinar',
      type_tab: 'webinar',
      series_group_id: 'series-beta',
      starts_at: futureIso(11),
    }),
  ];
  const sb = createMockSb(rows);
  const payload = await fetchBrowseEventsPage(sb, {
    page: 1,
    limit: 12,
    meta: '1',
    sort: 'date',
  });

  assert('small catalogue scans the slim index once', slimScanCount(sb) === 1);
  assert('series dates collapse to one listing', payload.pagination.listingTotal === 2);
  assert('date total still counts each occurrence', payload.pagination.total === 3);
  assert('page returns both listings', payload.events.length === 2);
  assert(
    'type chips are counted from that same scan',
    payload.meta &&
      payload.meta.typeCounts &&
      payload.meta.typeCounts.all === 2 &&
      payload.meta.typeCounts.meeting === 1 &&
      payload.meta.typeCounts.webinar === 1
  );

  const before = slimScanCount(sb);
  await fetchBrowseEventsPage(sb, { page: 2, limit: 12, meta: '0', sort: 'recommended' });
  assert('paging reuses the catalogue instead of scanning again', slimScanCount(sb) === before);
}

async function testFullCapIsOneScan() {
  clearBrowseCatalogueCache();
  const rows = [];
  for (let i = 0; i < 5000; i += 1) {
    rows.push(
      eventRow('e' + i, {
        title: 'Listing ' + (i % 547),
        series_group_id: 'series-' + (i % 547),
        starts_at: futureIso(1 + (i % 40)),
        type_tab: i % 5 === 0 ? 'webinar' : 'meeting',
        event_type: i % 5 === 0 ? 'Webinar' : 'Meeting',
      })
    );
  }
  const sb = createMockSb(rows);
  const payload = await fetchBrowseEventsPage(sb, {
    page: 1,
    limit: 12,
    meta: '1',
    sort: 'recommended',
    inPerson: '1',
    online: '1',
  });
  assert('5000-row catalogue uses 5 slim pages, not 10', slimScanCount(sb) === 5);
  assert('first page still returns a grid', payload.events.length === 12);
  assert('type counts are present on the default events request', !!(payload.meta && payload.meta.typeCounts));

  clearBrowseCatalogueCache();
  const sb2 = createMockSb(rows);
  await Promise.all([
    fetchBrowseEventsPage(sb2, { page: 1, limit: 12, meta: '1' }),
    fetchBrowseEventsPage(sb2, { page: 1, limit: 12, meta: '1' }),
  ]);
  assert('two simultaneous page loads share one catalogue scan', slimScanCount(sb2) === 5);
}

async function testTypeFilterDoesNotDropChipCounts() {
  clearBrowseCatalogueCache();
  const rows = [
    eventRow('m1', { type_tab: 'meeting', event_type: 'Meeting' }),
    eventRow('w1', { type_tab: 'webinar', event_type: 'Webinar', title: 'Only webinar' }),
  ];
  const sb = createMockSb(rows);
  const payload = await fetchBrowseEventsPage(sb, {
    page: 1,
    limit: 12,
    meta: '1',
    types: 'webinar',
  });
  assert('type filter still scans once', slimScanCount(sb) === 1);
  assert(
    'chip counts stay catalogue-wide when a type is selected',
    payload.meta && payload.meta.typeCounts.all === 2 && payload.meta.typeCounts.meeting === 1
  );
  assert(
    'grid itself is limited to the selected type',
    payload.events.length === 1 && /webinar/i.test(String(payload.events[0].eventType || payload.events[0].title))
  );
}

async function main() {
  await testSmallCatalogue();
  await testFullCapIsOneScan();
  await testTypeFilterDoesNotDropChipCounts();
  if (failed) {
    console.error('\n' + failed + ' check(s) failed');
    process.exit(1);
  }
  console.log('\nAll browse events timeout checks passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
