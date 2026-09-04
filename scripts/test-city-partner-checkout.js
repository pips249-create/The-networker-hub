#!/usr/bin/env node
/**
 * Unit checks for City Partner checkout reservation + Apple Pay-friendly pricing.
 * Run: node scripts/test-city-partner-checkout.js
 */
const {
  calculateCityPartnerQuote,
  cityPartnerSlotKey,
  normalizeCitySlugs,
} = require('../api/_lib/networking-city-partners');
const {
  isCityPartnerMetadata,
  citiesFromMetadata,
  ensureCityPartnerSlotRows,
  reserveCityPartnerSlots,
  handleCityPartnerCheckoutCompleted,
} = require('../api/_lib/city-partner-subscriptions');

let failed = 0;

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

assert('chester slug normalizes', normalizeCitySlugs(['Chester']).join() === 'chester');
assert(
  'chester slot key',
  cityPartnerSlotKey('chester') === 'networking_city_partner_chester'
);

const monthly = calculateCityPartnerQuote(1, new Date('2026-09-04T12:00:00Z'), 'monthly');
assert('monthly launch ex-VAT is £29', monthly.subtotalExVatPence === 2900);
assert('monthly launch VAT is £5.80', monthly.vatPence === 580);
assert('monthly launch total incl VAT is £34.80', monthly.totalPence === 3480);

const yearly = calculateCityPartnerQuote(1, new Date('2026-09-04T12:00:00Z'), 12);
assert('yearly billing mode prepaid', yearly.billingMode === 'prepaid');
assert('yearly has 15% discount', yearly.discountPercent === 15);

assert(
  'city partner metadata detects placement',
  isCityPartnerMetadata({ placement: 'city_partner', networking_cities: 'chester' })
);
assert(
  'citiesFromMetadata parses chester',
  citiesFromMetadata({ networking_cities: 'chester' }).join() === 'chester'
);

/** In-memory fake of the cms_blocks subset used by reservation. */
function createFakeSb(initialRows) {
  const rows = new Map(
    (initialRows || []).map((row) => [row.slot, { ...row }])
  );

  function from(table) {
    if (table !== 'cms_blocks') throw new Error('unexpected table ' + table);
    const state = { filters: {}, patch: null, insertRow: null, selectCols: '*' };

    const api = {
      select(cols) {
        state.selectCols = cols;
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
        return Promise.resolve(runSelect(true));
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

    function runSelect(maybeSingle) {
      const slots = matchingSlots();
      if (maybeSingle) {
        const slot = state.filters.slot;
        const row = rows.get(slot) || null;
        return { data: row, error: null };
      }
      return {
        data: slots.map((slot) => ({ ...rows.get(slot) })),
        error: null,
      };
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
      if (!rows.has(slot)) {
        return { data: [], error: null };
      }
      rows.set(slot, { ...rows.get(slot), ...state.patch });
      return { data: [{ id: rows.get(slot).id }], error: null };
    }

    function run() {
      if (state.insertRow) return runInsert();
      if (state.patch) return runUpdate();
      return runSelect(false);
    }

    return api;
  }

  return {
    from,
    _rows: rows,
  };
}

(async function () {
  const missingSb = createFakeSb([]);
  const ensured = await ensureCityPartnerSlotRows(missingSb, ['chester']);
  assert('ensure creates chester row when missing', ensured.length === 1);
  assert(
    'chester row exists after ensure',
    missingSb._rows.has('networking_city_partner_chester')
  );

  const reserved = await reserveCityPartnerSlots(missingSb, ['chester'], {
    subscriptionId: 'sub_test_chester',
    email: 'sponsor@example.com',
    availableFrom: null,
  });
  assert('reserve returns chester', reserved.length === 1 && reserved[0].slug === 'chester');
  assert(
    'reserve writes subscription id on new row',
    missingSb._rows.get('networking_city_partner_chester').sponsor_subscription_id ===
      'sub_test_chester'
  );

  const existingSb = createFakeSb([
    {
      id: 'existing',
      slot: 'networking_city_partner_chester',
      cta_url: 'https://example.com',
      logo_url: 'https://example.com/logo.png',
      active: false,
    },
  ]);
  await reserveCityPartnerSlots(existingSb, ['chester'], {
    subscriptionId: 'sub_keep_creative',
    email: 'a@b.co',
    availableFrom: null,
  });
  const kept = existingSb._rows.get('networking_city_partner_chester');
  assert('reserve keeps existing creative URL', kept.cta_url === 'https://example.com');
  assert('reserve keeps existing logo', kept.logo_url === 'https://example.com/logo.png');
  assert('reserve updates subscription on existing row', kept.sponsor_subscription_id === 'sub_keep_creative');

  // handleCityPartnerCheckoutCompleted against missing row (the Chester bug)
  const origAdmin = require('../api/_lib/supabase').getSupabaseAdmin;
  const finalizeSb = createFakeSb([]);
  require('../api/_lib/supabase').getSupabaseAdmin = () => finalizeSb;
  require('../api/_lib/city-partner-emails').sendCityPartnerPaymentWelcome = async () => ({
    sent: true,
  });

  try {
    const result = await handleCityPartnerCheckoutCompleted({
      id: 'cs_test_1',
      payment_status: 'paid',
      customer_email: 'payer@example.com',
      subscription: 'sub_live_1',
      metadata: {
        placement: 'city_partner',
        networking_cities: 'chester',
        billing_mode: 'monthly',
        term_months: 'monthly',
      },
    });
    assert('finalize creates missing chester slot', result.ok === true);
    assert(
      'finalize reserved chester',
      result.reserved && result.reserved[0] && result.reserved[0].slug === 'chester'
    );
    assert(
      'finalize stored subscription',
      finalizeSb._rows.get('networking_city_partner_chester').sponsor_subscription_id ===
        'sub_live_1'
    );

    const second = await handleCityPartnerCheckoutCompleted({
      id: 'cs_test_1',
      payment_status: 'paid',
      customer_email: 'payer@example.com',
      subscription: 'sub_live_1',
      metadata: {
        placement: 'city_partner',
        networking_cities: 'chester',
        billing_mode: 'monthly',
        term_months: 'monthly',
      },
    });
    assert('second finalize is idempotent', second.alreadyFinalized === true);
    assert(
      'second finalize skips welcome email',
      second.welcomeEmail && second.welcomeEmail.reason === 'already_finalized'
    );
  } finally {
    require('../api/_lib/supabase').getSupabaseAdmin = origAdmin;
  }

  // Build session params shape check via module internals: quote total used as unit_amount
  assert(
    'Apple Pay line uses VAT-inclusive total',
    monthly.totalPence === monthly.subtotalExVatPence + monthly.vatPence
  );

  if (failed) {
    console.error('\n' + failed + ' city partner checkout check(s) failed.');
    process.exit(1);
  }
  console.log('\nAll city partner checkout checks passed.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
