#!/usr/bin/env node
/**
 * Unit checks for County Sponsor checkout reservation + pricing.
 * Run: node scripts/test-county-partner-checkout.js
 */
const {
  calculateCountyPartnerQuote,
  countyPartnerSlotKey,
  normalizeCountySlugs,
  listCountyPartnerRegions,
} = require('../api/_lib/networking-county-partners');
const {
  isCountyPartnerMetadata,
  countiesFromMetadata,
  ensureCountyPartnerSlotRows,
  reserveCountyPartnerSlots,
  handleCountyPartnerCheckoutCompleted,
} = require('../api/_lib/county-partner-subscriptions');

let failed = 0;

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

assert('cheshire slug normalizes', normalizeCountySlugs(['Cheshire']).join() === 'cheshire');
assert(
  'cheshire slot key',
  countyPartnerSlotKey('cheshire') === 'networking_county_partner_cheshire'
);
assert('twelve launch counties', listCountyPartnerRegions().length === 12);
assert(
  'city slug rejected',
  normalizeCountySlugs(['chester', 'manchester']).length === 0
);

const monthly = calculateCountyPartnerQuote(1, new Date('2026-09-04T12:00:00Z'), 'monthly');
assert('monthly launch ex-VAT is £49', monthly.subtotalExVatPence === 4900);
assert('monthly launch VAT is £9.80', monthly.vatPence === 980);
assert('monthly launch total incl VAT is £58.80', monthly.totalPence === 5880);

const two = calculateCountyPartnerQuote(2, new Date('2026-09-04T12:00:00Z'), 'monthly');
assert('two counties = 2×£49', two.subtotalExVatPence === 9800);

const yearly = calculateCountyPartnerQuote(1, new Date('2026-09-04T12:00:00Z'), 12);
assert('yearly billing mode prepaid', yearly.billingMode === 'prepaid');
assert('yearly has 15% discount', yearly.discountPercent === 15);

assert(
  'county metadata detects placement',
  isCountyPartnerMetadata({ placement: 'county_partner', networking_counties: 'cheshire' })
);
assert(
  'city placement is not county',
  !isCountyPartnerMetadata({ placement: 'city_partner', networking_cities: 'chester' })
);
assert(
  'countiesFromMetadata parses cheshire',
  countiesFromMetadata({ networking_counties: 'cheshire' }).join() === 'cheshire'
);

function createFakeSb(initialRows) {
  const rows = new Map((initialRows || []).map((row) => [row.slot, { ...row }]));

  function from(table) {
    if (table !== 'cms_blocks') throw new Error('unexpected table ' + table);
    const state = { filters: {}, patch: null, insertRow: null };

    const api = {
      select() {
        return api;
      },
      insert(row) {
        state.insertRow = row;
        return {
          then(resolve, reject) {
            return Promise.resolve(runInsert()).then(resolve, reject);
          },
        };
      },
      update(patch) {
        state.patch = patch;
        return api;
      },
      eq(col, val) {
        state.filters[col] = val;
        return api;
      },
      in(col, vals) {
        state.filters[col] = { in: vals };
        return api;
      },
      maybeSingle() {
        return Promise.resolve({ data: rows.get(state.filters.slot) || null, error: null });
      },
      then(resolve, reject) {
        return Promise.resolve(run()).then(resolve, reject);
      },
    };

    function matchingSlots() {
      if (state.filters.slot && state.filters.slot.in) {
        return state.filters.slot.in.filter((slot) => rows.has(slot));
      }
      if (state.filters.slot) {
        return rows.has(state.filters.slot) ? [state.filters.slot] : [];
      }
      return Array.from(rows.keys());
    }

    function runInsert() {
      const row = state.insertRow;
      if (rows.has(row.slot)) {
        return { data: null, error: { message: 'duplicate key value violates unique constraint' } };
      }
      rows.set(row.slot, { id: 'new-' + row.slot, ...row });
      return { data: [{ id: 'new-' + row.slot }], error: null };
    }

    function runUpdate() {
      const slot = state.filters.slot;
      if (!rows.has(slot)) return { data: [], error: null };
      rows.set(slot, { ...rows.get(slot), ...state.patch });
      return { data: [{ id: rows.get(slot).id }], error: null };
    }

    function run() {
      if (state.insertRow) return runInsert();
      if (state.patch) return runUpdate();
      return { data: matchingSlots().map((slot) => ({ ...rows.get(slot) })), error: null };
    }

    return api;
  }

  return { from, _rows: rows };
}

(async function () {
  const missingSb = createFakeSb([]);
  const ensured = await ensureCountyPartnerSlotRows(missingSb, ['cheshire']);
  assert('ensure creates cheshire row when missing', ensured.length === 1);

  const reserved = await reserveCountyPartnerSlots(missingSb, ['cheshire'], {
    subscriptionId: 'sub_test_cheshire',
    email: 'sponsor@example.com',
    availableFrom: null,
  });
  assert('reserve returns cheshire', reserved.length === 1 && reserved[0].slug === 'cheshire');
  assert(
    'reserve writes subscription id',
    missingSb._rows.get('networking_county_partner_cheshire').sponsor_subscription_id ===
      'sub_test_cheshire'
  );

  const supabaseMod = require('../api/_lib/supabase');
  const origAdmin = supabaseMod.getSupabaseAdmin;
  const finalizeSb = createFakeSb([]);
  supabaseMod.getSupabaseAdmin = () => finalizeSb;
  require('../api/_lib/county-partner-emails').sendCountyPartnerPaymentWelcome = async () => ({
    sent: true,
  });

  try {
    const result = await handleCountyPartnerCheckoutCompleted({
      id: 'cs_test_county',
      payment_status: 'paid',
      customer_email: 'payer@example.com',
      subscription: 'sub_county_1',
      metadata: {
        placement: 'county_partner',
        networking_counties: 'cheshire',
        billing_mode: 'monthly',
        term_months: 'monthly',
      },
    });
    assert('finalize creates missing cheshire slot', result.ok === true);
    assert(
      'finalize reserved cheshire',
      result.reserved && result.reserved[0] && result.reserved[0].slug === 'cheshire'
    );

    const second = await handleCountyPartnerCheckoutCompleted({
      id: 'cs_test_county',
      payment_status: 'paid',
      customer_email: 'payer@example.com',
      subscription: 'sub_county_1',
      metadata: {
        placement: 'county_partner',
        networking_counties: 'cheshire',
        billing_mode: 'monthly',
        term_months: 'monthly',
      },
    });
    assert('second finalize is idempotent', second.alreadyFinalized === true);
  } finally {
    supabaseMod.getSupabaseAdmin = origAdmin;
  }

  assert(
    'VAT-inclusive total',
    monthly.totalPence === monthly.subtotalExVatPence + monthly.vatPence
  );

  if (failed) {
    console.error('\n' + failed + ' county partner checkout check(s) failed.');
    process.exit(1);
  }
  console.log('\nAll county partner checkout checks passed.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
