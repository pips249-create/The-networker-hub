#!/usr/bin/env node
/**
 * Unit checks for Opportunity Page Partner checkout reservation + pricing.
 * Run: node scripts/test-opportunity-page-partner-checkout.js
 */
const {
  calculateOpportunityPagePartnerQuote,
  normalizeOpportunityPagePartnerTerm,
  validateOpportunityPagePartnerCheckout,
  occupancyFromRow,
  OPPORTUNITY_PAGE_CAROUSEL_SLOT,
} = require('../api/_lib/opportunity-page-partner');
const {
  isOpportunityPagePartnerMetadata,
  reserveOpportunityPagePartnerSlot,
  handleOpportunityPagePartnerCheckoutCompleted,
} = require('../api/_lib/opportunity-page-partner-subscriptions');
const {
  serializeCarouselBody,
  normalizeCarouselAdsList,
  isCarouselAdHeld,
} = require('../api/_lib/event-page-carousel');

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
  'monthly term normalizes',
  normalizeOpportunityPagePartnerTerm('monthly').billingMode === 'monthly'
);
assert(
  '3 month prepaid normalizes',
  normalizeOpportunityPagePartnerTerm(3).termMonths === 3 &&
    normalizeOpportunityPagePartnerTerm(3).billingMode === 'prepaid'
);

const monthly = calculateOpportunityPagePartnerQuote(1, new Date('2026-09-04T12:00:00Z'), 'monthly');
assert('monthly ex-VAT is £600', monthly.subtotalExVatPence === 60000);
assert('monthly VAT is £120', monthly.vatPence === 12000);
assert('monthly total incl VAT is £720', monthly.totalPence === 72000);

const three = calculateOpportunityPagePartnerQuote(1, new Date('2026-09-04T12:00:00Z'), 3);
assert('3-month billing prepaid', three.billingMode === 'prepaid');
assert('3-month has 5% discount', three.discountPercent === 5);
assert(
  '3-month net is 3×£600 less 5%',
  three.subtotalExVatPence === Math.round(180000 * 0.95)
);

const yearly = calculateOpportunityPagePartnerQuote(1, new Date('2026-09-04T12:00:00Z'), 12);
assert('yearly has 15% discount', yearly.discountPercent === 15);

assert(
  'metadata detects placement',
  isOpportunityPagePartnerMetadata({ placement: 'opportunity_page_partner' })
);
assert(
  'legacy mini sponsor placement accepted',
  isOpportunityPagePartnerMetadata({ placement: 'opportunities_mini_sponsor' })
);
assert(
  'cms_slot alone detects package',
  isOpportunityPagePartnerMetadata({ cms_slot: OPPORTUNITY_PAGE_CAROUSEL_SLOT })
);
assert(
  'county placement is not opp page partner',
  !isOpportunityPagePartnerMetadata({ placement: 'county_partner' })
);

const emptyOcc = occupancyFromRow(null);
assert('empty row has 3 available', emptyOcc.available === 3 && emptyOcc.taken === 0);

const heldBody = serializeCarouselBody([
  {
    id: 'opportunity_carousel_1',
    slot_index: 0,
    active: false,
    sponsor_subscription_id: 'sub_test',
    reserved_at: '2026-09-01T00:00:00.000Z',
  },
]);
const heldOcc = occupancyFromRow({ body: heldBody, active: true });
assert('paid hold counts as taken', heldOcc.taken === 1 && heldOcc.available === 2);
assert(
  'held ad is held without logo',
  isCarouselAdHeld(
    normalizeCarouselAdsList(JSON.parse(heldBody).ads, OPPORTUNITY_PAGE_CAROUSEL_SLOT)[0]
  )
);

assert(
  'validate rejects when full',
  !validateOpportunityPagePartnerCheckout({ available: 0 }, 'monthly', 1).ok
);
assert(
  'validate accepts monthly when open',
  validateOpportunityPagePartnerCheckout({ available: 2 }, 'monthly', 1).ok
);

function createFakeSb(initialRow) {
  const rows = new Map();
  if (initialRow) {
    rows.set(initialRow.slot || OPPORTUNITY_PAGE_CAROUSEL_SLOT, { ...initialRow });
  }

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
      maybeSingle() {
        return Promise.resolve({
          data: rows.get(state.filters.slot) || null,
          error: null,
        });
      },
      then(resolve, reject) {
        return Promise.resolve(run()).then(resolve, reject);
      },
    };

    function runInsert() {
      const row = state.insertRow;
      if (rows.has(row.slot)) {
        return { data: null, error: { message: 'duplicate key' } };
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
      return { data: rows.get(state.filters.slot) || null, error: null };
    }

    return api;
  }

  return {
    from,
    getRow() {
      return rows.get(OPPORTUNITY_PAGE_CAROUSEL_SLOT) || null;
    },
  };
}

(async function () {
  const sb = createFakeSb(null);
  const reserved = await reserveOpportunityPagePartnerSlot(sb, {
    subscriptionId: 'sub_abc',
    email: 'buyer@example.com',
    availableFrom: null,
  });
  assert('reserves first free carousel index', reserved.slotIndex === 0);
  assert('creates cms row when missing', Boolean(sb.getRow()));
  const ads = normalizeCarouselAdsList(
    JSON.parse(sb.getRow().body).ads,
    OPPORTUNITY_PAGE_CAROUSEL_SLOT
  );
  assert('reserved ad inactive until creative', ads[0].active === false);
  assert('subscription id stored', ads[0].sponsor_subscription_id === 'sub_abc');

  const again = await reserveOpportunityPagePartnerSlot(sb, {
    subscriptionId: 'sub_abc',
    email: 'buyer@example.com',
  });
  assert('idempotent reserve same subscription', again.alreadyReserved === true);

  const second = await reserveOpportunityPagePartnerSlot(sb, {
    subscriptionId: 'sub_def',
    email: 'two@example.com',
  });
  assert('second payment takes next slot', second.slotIndex === 1);

  const supabaseMod = require('../api/_lib/supabase');
  const origAdmin = supabaseMod.getSupabaseAdmin;
  supabaseMod.getSupabaseAdmin = () => sb;
  require('../api/_lib/opportunity-page-partner-emails').sendOpportunityPagePartnerPaymentWelcome =
    async () => ({ sent: true });

  try {
    const finalized = await handleOpportunityPagePartnerCheckoutCompleted({
      id: 'cs_test',
      payment_status: 'paid',
      customer_email: 'three@example.com',
      subscription: 'sub_ghi',
      metadata: {
        placement: 'opportunity_page_partner',
        billing_mode: 'monthly',
        term_months: 'monthly',
        cms_slot: OPPORTUNITY_PAGE_CAROUSEL_SLOT,
      },
    });
    assert('checkout completed reserves slot', finalized.ok === true);
    assert('third slot reserved', finalized.reserved.slotIndex === 2);
  } finally {
    supabaseMod.getSupabaseAdmin = origAdmin;
  }

  const full = createFakeSb({
    id: 'row1',
    slot: OPPORTUNITY_PAGE_CAROUSEL_SLOT,
    body: serializeCarouselBody([
      {
        id: 'opportunity_carousel_1',
        slot_index: 0,
        active: true,
        logo_url: 'https://cdn.example/a.png',
        cta_url: 'https://a.example',
        sponsor_subscription_id: 's1',
      },
      {
        id: 'opportunity_carousel_2',
        slot_index: 1,
        active: true,
        logo_url: 'https://cdn.example/b.png',
        cta_url: 'https://b.example',
        sponsor_subscription_id: 's2',
      },
      {
        id: 'opportunity_carousel_3',
        slot_index: 2,
        active: false,
        sponsor_subscription_id: 's3',
        reserved_at: '2026-09-01T00:00:00.000Z',
      },
    ]),
    active: true,
  });
  let threw = false;
  try {
    await reserveOpportunityPagePartnerSlot(full, {
      subscriptionId: 'sub_overflow',
      email: 'x@example.com',
    });
  } catch (e) {
    threw = e.message === 'no_opportunity_page_partner_slots';
  }
  assert('fourth reservation rejected', threw);

  assert(
    'VAT-inclusive total',
    monthly.totalPence === monthly.subtotalExVatPence + monthly.vatPence
  );

  if (failed) {
    console.error('\n' + failed + ' assertion(s) failed');
    process.exit(1);
  }
  console.log('\nAll Opportunity Page Partner checkout checks passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
