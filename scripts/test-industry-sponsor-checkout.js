#!/usr/bin/env node
/**
 * Unit checks for Industry Sponsor checkout reservation + pricing.
 * Run: node scripts/test-industry-sponsor-checkout.js
 */
const {
  calculateIndustrySponsorQuote,
  industrySponsorSlotKey,
  normalizeIndustrySlugs,
  listIndustrySponsorCategories,
} = require('../api/_lib/opportunity-industry-sponsors');
const {
  isIndustrySponsorMetadata,
  industriesFromMetadata,
  ensureIndustrySponsorSlotRows,
  reserveIndustrySponsorSlots,
  handleIndustrySponsorCheckoutCompleted,
} = require('../api/_lib/industry-sponsor-subscriptions');
const { ICONS, iconForIndustry } = require('../api/_lib/industry-line-icons');

let failed = 0;

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

assert('tech slug normalizes', normalizeIndustrySlugs(['Tech']).join() === 'tech');
assert(
  'tech slot key',
  industrySponsorSlotKey('tech') === 'opportunity_industry_sponsor_tech'
);
assert('eighteen sellable industries', listIndustrySponsorCategories().length === 18);
assert('mlm rejected', normalizeIndustrySlugs(['mlm', 'general']).length === 0);
assert('all category icons present', listIndustrySponsorCategories().every((c) => iconForIndustry(c.slug)));
assert('cleaning icon has chip svg', String(ICONS.cleaning.chip).indexOf('<svg') === 0);

const monthly = calculateIndustrySponsorQuote(1, new Date('2026-09-04T12:00:00Z'), 'monthly');
assert('monthly launch ex-VAT is £49', monthly.subtotalExVatPence === 4900);
assert('monthly launch VAT is £9.80', monthly.vatPence === 980);
assert('monthly launch total incl VAT is £58.80', monthly.totalPence === 5880);

const two = calculateIndustrySponsorQuote(2, new Date('2026-09-04T12:00:00Z'), 'monthly');
assert('two industries = 2×£49', two.subtotalExVatPence === 9800);

const yearly = calculateIndustrySponsorQuote(1, new Date('2026-09-04T12:00:00Z'), 12);
assert('yearly billing mode prepaid', yearly.billingMode === 'prepaid');
assert('yearly has 15% discount', yearly.discountPercent === 15);

assert(
  'industry metadata detects placement',
  isIndustrySponsorMetadata({ placement: 'industry_sponsor', opportunity_industries: 'tech' })
);
assert(
  'city placement is not industry',
  !isIndustrySponsorMetadata({ placement: 'city_partner', networking_cities: 'chester' })
);
assert(
  'industriesFromMetadata parses tech',
  industriesFromMetadata({ opportunity_industries: 'tech' }).join() === 'tech'
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
      if (slot && slot.in) {
        slot.in.forEach((s) => {
          if (rows.has(s)) rows.set(s, { ...rows.get(s), ...state.patch });
        });
        return { data: [], error: null };
      }
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
  const ensured = await ensureIndustrySponsorSlotRows(missingSb, ['tech']);
  assert('ensure creates tech row when missing', ensured.length === 1);

  const reserved = await reserveIndustrySponsorSlots(missingSb, ['tech'], {
    subscriptionId: 'sub_test_tech',
    email: 'sponsor@example.com',
    availableFrom: null,
  });
  assert('reserve returns tech', reserved.length === 1 && reserved[0].slug === 'tech');
  assert(
    'reserve writes subscription id',
    missingSb._rows.get('opportunity_industry_sponsor_tech').sponsor_subscription_id ===
      'sub_test_tech'
  );

  const supabaseMod = require('../api/_lib/supabase');
  const origAdmin = supabaseMod.getSupabaseAdmin;
  const finalizeSb = createFakeSb([]);
  supabaseMod.getSupabaseAdmin = () => finalizeSb;
  require('../api/_lib/industry-sponsor-emails').sendIndustrySponsorPaymentWelcome = async () => ({
    sent: true,
  });

  try {
    const result = await handleIndustrySponsorCheckoutCompleted({
      id: 'cs_test_industry',
      payment_status: 'paid',
      customer_email: 'payer@example.com',
      subscription: 'sub_industry_1',
      metadata: {
        placement: 'industry_sponsor',
        opportunity_industries: 'tech',
        billing_mode: 'monthly',
        term_months: 'monthly',
      },
    });
    assert('finalize creates missing tech slot', result.ok === true);
    assert(
      'finalize reserved tech',
      result.reserved && result.reserved[0] && result.reserved[0].slug === 'tech'
    );

    const second = await handleIndustrySponsorCheckoutCompleted({
      id: 'cs_test_industry',
      payment_status: 'paid',
      customer_email: 'payer@example.com',
      subscription: 'sub_industry_1',
      metadata: {
        placement: 'industry_sponsor',
        opportunity_industries: 'tech',
        billing_mode: 'monthly',
        term_months: 'monthly',
      },
    });
    assert('second finalize is idempotent', second.alreadyFinalized === true);
  } finally {
    supabaseMod.getSupabaseAdmin = origAdmin;
  }

  if (failed) {
    console.error('\n' + failed + ' industry sponsor checkout check(s) failed.');
    process.exit(1);
  }
  console.log('\nAll industry sponsor checkout checks passed.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
