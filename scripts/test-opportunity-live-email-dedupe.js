#!/usr/bin/env node
/**
 * Unit checks for opportunity "live" email send-once dedupe.
 * Run: node scripts/test-opportunity-live-email-dedupe.js
 */
const { claimRowTimestamp, releaseRowTimestamp } = require('../api/_lib/email-send-claim');
const {
  listingLiveEmailIdempotencyKey,
  sendOpportunityListingLiveEmail,
} = require('../api/_lib/opportunity-emails');

let failed = 0;

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

assert(
  'idempotency key includes opportunity id + paid at',
  listingLiveEmailIdempotencyKey({
    id: '11111111-1111-4111-8111-111111111111',
    listingPaidAt: '2026-08-29T10:00:00.000Z',
  }) === 'opp-listing-live:11111111-1111-4111-8111-111111111111:2026-08-29T10:00:00.000Z'
);

assert(
  'idempotency key falls back without paid at',
  listingLiveEmailIdempotencyKey({ id: 'abc' }) === 'opp-listing-live:abc:nopay'
);

assert('idempotency key omitted without id', listingLiveEmailIdempotencyKey({}) === undefined);

function mockSb(store) {
  return {
    from(table) {
      assert('claims business_opportunities', table === 'business_opportunities');
      const state = {
        updates: null,
        filters: [],
      };

      function applyUpdate() {
        const idFilter = state.filters.find((f) => f.op === 'eq' && f.col === 'id');
        const col = Object.keys(state.updates || {})[0];
        const isNull = state.filters.find((f) => f.op === 'is' && f.col === col && f.val == null);
        const eqPrev = state.filters.find((f) => f.op === 'eq' && f.col === col);
        const rowId = idFilter && idFilter.val;
        const row = store[rowId];
        if (!row || !col) return { data: [], error: null };

        if (state.updates[col] === null && eqPrev) {
          if (row[col] !== eqPrev.val) return { data: [], error: null };
          row[col] = null;
          return { data: [{ id: rowId }], error: null };
        }

        if (isNull) {
          if (row[col] != null) return { data: [], error: null };
          row[col] = state.updates[col];
          return { data: [{ id: rowId }], error: null };
        }

        return { data: [], error: null };
      }

      const api = {
        update(patch) {
          state.updates = patch;
          return api;
        },
        eq(col, val) {
          state.filters.push({ op: 'eq', col, val });
          return api;
        },
        is(col, val) {
          state.filters.push({ op: 'is', col, val });
          return api;
        },
        select() {
          return api;
        },
        then(resolve, reject) {
          return Promise.resolve(applyUpdate()).then(resolve, reject);
        },
      };
      return api;
    },
  };
}

async function runAsyncChecks() {
  const id = '22222222-2222-4222-8222-222222222222';
  const store = { [id]: { listing_live_email_sent_at: null } };
  const sb = mockSb(store);

  const firstClaim = await claimRowTimestamp(sb, {
    table: 'business_opportunities',
    id,
    column: 'listing_live_email_sent_at',
    claimedAt: '2026-08-29T12:00:00.000Z',
    previousValue: null,
  });
  assert('first claim wins', firstClaim === true);
  assert(
    'column stamped after claim',
    store[id].listing_live_email_sent_at === '2026-08-29T12:00:00.000Z'
  );

  const secondClaim = await claimRowTimestamp(sb, {
    table: 'business_opportunities',
    id,
    column: 'listing_live_email_sent_at',
    claimedAt: '2026-08-29T12:05:00.000Z',
    previousValue: null,
  });
  assert('second claim loses', secondClaim === false);
  assert(
    'column unchanged after lost claim',
    store[id].listing_live_email_sent_at === '2026-08-29T12:00:00.000Z'
  );

  await releaseRowTimestamp(sb, {
    table: 'business_opportunities',
    id,
    column: 'listing_live_email_sent_at',
    claimedAt: '2026-08-29T12:00:00.000Z',
  });
  assert('release clears matching stamp', store[id].listing_live_email_sent_at == null);

  const store2 = { [id]: { listing_live_email_sent_at: '2026-08-29T11:00:00.000Z' } };
  let sendCount = 0;
  const skipped = await sendOpportunityListingLiveEmail(
    {
      id,
      title: 'Get Ahead Virtual Agency',
      ownerEmail: 'rebecca@getaheadva.com',
      listingPaidAt: '2026-08-29T10:00:00.000Z',
    },
    {
      sb: mockSb(store2),
      sendTemplatedEmail: async function () {
        sendCount += 1;
      },
    }
  );
  assert('already-sent skips Resend', skipped.skipped === true && skipped.reason === 'already_sent');
  assert('already-sent does not call Resend', sendCount === 0);

  const store3 = { [id]: { listing_live_email_sent_at: null } };
  let captured = null;
  const sent = await sendOpportunityListingLiveEmail(
    {
      id,
      title: 'Get Ahead Virtual Agency',
      ownerEmail: 'rebecca@getaheadva.com',
      listingPaidAt: '2026-08-29T10:00:00.000Z',
    },
    {
      sb: mockSb(store3),
      sendTemplatedEmail: async function (opts) {
        captured = opts;
        sendCount += 1;
      },
    }
  );
  assert('first send succeeds', sent.sent === true);
  assert('first send calls Resend once', sendCount === 1);
  assert(
    'first send stamps claim',
    store3[id].listing_live_email_sent_at != null
  );
  assert(
    'Resend idempotency key set',
    captured &&
      captured.idempotencyKey ===
        'opp-listing-live:22222222-2222-4222-8222-222222222222:2026-08-29T10:00:00.000Z'
  );

  const store4 = { [id]: { listing_live_email_sent_at: null } };
  let released = false;
  const failingSb = mockSb(store4);
  try {
    await sendOpportunityListingLiveEmail(
      {
        id,
        title: 'Get Ahead Virtual Agency',
        ownerEmail: 'rebecca@getaheadva.com',
        listingPaidAt: '2026-08-29T10:00:00.000Z',
      },
      {
        sb: failingSb,
        sendTemplatedEmail: async function () {
          released = store4[id].listing_live_email_sent_at != null;
          throw new Error('resend_down');
        },
      }
    );
    assert('send failure throws', false);
  } catch (e) {
    assert('send failure throws', e.message === 'resend_down');
  }
  assert('send failure released claim before throw', released === true);
  assert('claim cleared after send failure', store4[id].listing_live_email_sent_at == null);
}

runAsyncChecks()
  .then(function () {
    if (failed) {
      console.error('\n' + failed + ' opportunity live email dedupe check(s) failed.');
      process.exit(1);
    }
    console.log('\nAll opportunity live email dedupe checks passed.');
  })
  .catch(function (err) {
    console.error(err);
    process.exit(1);
  });
