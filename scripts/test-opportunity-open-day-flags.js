#!/usr/bin/env node
/**
 * Browse open-day flags must not `.in()` hundreds of opportunity ids
 * (PostgREST URL limits / stalls that empty the opportunities page).
 *
 * Run: node scripts/test-opportunity-open-day-flags.js
 */
'use strict';

const openDays = require('../api/_lib/opportunity-open-days');

let failed = 0;
function assert(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

function uuid(n) {
  const hex = String(n).padStart(12, '0');
  return `11111111-1111-4111-8111-${hex}`;
}

const calls = [];
const fakeSb = {
  from(table) {
    const state = { table, filters: [], limit: null, select: null };
    const builder = {
      select(cols) {
        state.select = cols;
        return builder;
      },
      gte(col, val) {
        state.filters.push(['gte', col, val]);
        return builder;
      },
      in(col, vals) {
        state.filters.push(['in', col, vals]);
        return builder;
      },
      limit(n) {
        state.limit = n;
        return builder;
      },
      then(resolve, reject) {
        calls.push({
          table: state.table,
          select: state.select,
          filters: state.filters.slice(),
          limit: state.limit,
        });
        resolve({
          data: [
            { opportunity_id: uuid(1) },
            { opportunity_id: uuid(99) },
          ],
          error: null,
        });
      },
    };
    return builder;
  },
};

openDays.__setSupabaseAdminForTests = null;

// Patch via require cache of supabase module used by open-days.
const supabase = require('../api/_lib/supabase');
const originalGet = supabase.getSupabaseAdmin;
supabase.getSupabaseAdmin = function () {
  return fakeSb;
};

const listings = [];
for (let i = 1; i <= 400; i++) {
  listings.push({ id: uuid(i), title: 'Listing ' + i });
}

openDays
  .attachOpenDayFlagsToListings(listings)
  .then((out) => {
    assert('returns same list length', out.length === 400);
    assert('marks matching open day', out[0].hasOpenDay === true);
    assert('marks listing without open day false', out[1].hasOpenDay === false);
    assert('one query issued', calls.length === 1);
    assert('queries opportunity_open_days', calls[0].table === 'opportunity_open_days');
    assert(
      'does not use opportunity_id IN filter',
      !calls[0].filters.some((f) => f[0] === 'in' && f[1] === 'opportunity_id')
    );
    assert(
      'filters upcoming starts_at',
      calls[0].filters.some((f) => f[0] === 'gte' && f[1] === 'starts_at')
    );
    assert('caps scan with limit', calls[0].limit === 2000);

    supabase.getSupabaseAdmin = originalGet;
    if (failed) {
      console.error('\n' + failed + ' check(s) failed');
      process.exit(1);
    }
    console.log('\nAll opportunity open-day flag checks passed');
  })
  .catch((err) => {
    supabase.getSupabaseAdmin = originalGet;
    console.error(err);
    process.exit(1);
  });
