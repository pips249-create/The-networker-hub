/**
 * Opportunity Page Partner — £600/slot/mo self-serve checkout helpers.
 * Inventory: opportunity_page_carousel_ads (3 named carousel ads).
 */
const {
  OPPORTUNITY_PAGE_CAROUSEL_SLOT,
  EVENT_PAGE_CAROUSEL_SIZE,
  parseCarouselBody,
  normalizeCarouselAdsList,
  isCarouselAdHeld,
} = require('./event-page-carousel');
const { applyPrepaidTermDiscount } = require('./sponsorship-term-discounts');

const OPPORTUNITY_PAGE_PARTNER_VAT_RATE = 0.2;
const OPPORTUNITY_PAGE_PARTNER_MONTHLY_PENCE = 60000;
const OPPORTUNITY_PAGE_PARTNER_PREPAID_TERMS = [1, 3, 6, 12];

function normalizeOpportunityPagePartnerTerm(value) {
  const raw = String(value == null ? '' : value).trim().toLowerCase();
  if (!raw || raw === 'monthly' || raw === 'month' || raw === 'rolling' || raw === '0') {
    return { billingMode: 'monthly', termMonths: null };
  }
  if (raw === 'yearly' || raw === 'year' || raw === 'annual' || raw === 'annually') {
    return { billingMode: 'prepaid', termMonths: 12 };
  }
  const n = parseInt(raw, 10);
  if (OPPORTUNITY_PAGE_PARTNER_PREPAID_TERMS.includes(n)) {
    return { billingMode: 'prepaid', termMonths: n };
  }
  return { billingMode: 'monthly', termMonths: null };
}

function isOfferedOpportunityPagePartnerTerm(term) {
  const normalized = normalizeOpportunityPagePartnerTerm(term);
  if (normalized.billingMode === 'monthly') return true;
  return OPPORTUNITY_PAGE_PARTNER_PREPAID_TERMS.includes(normalized.termMonths);
}

function addMonthsUtc(baseDate, months) {
  const d = new Date(baseDate);
  d.setUTCMonth(d.getUTCMonth() + Math.max(0, Math.floor(Number(months) || 0)));
  return d;
}

function isPrepaidOpportunityPagePartnerHoldId(subscriptionId) {
  return String(subscriptionId || '')
    .trim()
    .toLowerCase()
    .startsWith('prepaid:');
}

function calculateOpportunityPagePartnerQuote(slotCount = 1, now = new Date(), term = null) {
  const count = Math.max(1, Math.min(EVENT_PAGE_CAROUSEL_SIZE, Math.floor(Number(slotCount) || 1)));
  const { billingMode, termMonths } = normalizeOpportunityPagePartnerTerm(term);
  const billableMonths = billingMode === 'prepaid' ? termMonths : 1;
  const listSubtotalExVatPence = OPPORTUNITY_PAGE_PARTNER_MONTHLY_PENCE * count * billableMonths;
  const discounted =
    billingMode === 'prepaid'
      ? applyPrepaidTermDiscount(listSubtotalExVatPence, termMonths)
      : {
          listPence: listSubtotalExVatPence,
          discountPercent: 0,
          discountPence: 0,
          netPence: listSubtotalExVatPence,
        };
  const subtotalExVatPence = discounted.netPence;
  const vatPence = Math.round(subtotalExVatPence * OPPORTUNITY_PAGE_PARTNER_VAT_RATE);
  return {
    slotCount: count,
    billingMode,
    termMonths,
    monthlyPence: OPPORTUNITY_PAGE_PARTNER_MONTHLY_PENCE * count,
    monthlyGbp: (OPPORTUNITY_PAGE_PARTNER_MONTHLY_PENCE * count) / 100,
    listSubtotalExVatPence: discounted.listPence,
    discountPercent: discounted.discountPercent,
    discountPence: discounted.discountPence,
    subtotalExVatPence,
    vatPence,
    totalPence: subtotalExVatPence + vatPence,
    maxSlots: EVENT_PAGE_CAROUSEL_SIZE,
    cmsSlot: OPPORTUNITY_PAGE_CAROUSEL_SLOT,
  };
}

function occupancyFromRow(row, now = new Date()) {
  const ads = normalizeCarouselAdsList(parseCarouselBody(row?.body), OPPORTUNITY_PAGE_CAROUSEL_SLOT);
  const held = ads.filter((ad) => isCarouselAdHeld(ad, now));
  return {
    max: EVENT_PAGE_CAROUSEL_SIZE,
    taken: held.length,
    available: Math.max(0, EVENT_PAGE_CAROUSEL_SIZE - held.length),
    ads,
    held,
  };
}

async function getOpportunityPagePartnerAvailability(sb) {
  const { data: row, error } = await sb
    .from('cms_blocks')
    .select('*')
    .eq('slot', OPPORTUNITY_PAGE_CAROUSEL_SLOT)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const occupancy = occupancyFromRow(row);
  return {
    ok: true,
    cmsSlot: OPPORTUNITY_PAGE_CAROUSEL_SLOT,
    max: occupancy.max,
    taken: occupancy.taken,
    available: occupancy.available,
    pricing: {
      singleMonthlyGbp: OPPORTUNITY_PAGE_PARTNER_MONTHLY_PENCE / 100,
      singleLabel: '£600',
      vatRate: OPPORTUNITY_PAGE_PARTNER_VAT_RATE,
      prepaidTerms: OPPORTUNITY_PAGE_PARTNER_PREPAID_TERMS.slice(),
      prepaidDiscounts: { 3: 5, 6: 10, 12: 15 },
      termNote:
        'Pay monthly and cancel any time, or prepay 1 / 3 / 6 / 12 months — 5% / 10% / 15% off longer prepaid terms.',
    },
  };
}

function validateOpportunityPagePartnerCheckout(availability, term = null, slotCount = 1) {
  const count = Math.max(1, Math.floor(Number(slotCount) || 1));
  if (count !== 1) {
    return { ok: false, error: 'invalid_quantity', message: 'Checkout one Page Partner slot at a time.' };
  }
  if (!availability || Number(availability.available) < count) {
    return {
      ok: false,
      error: 'slots_unavailable',
      message: 'No Opportunity Page Partner slots are available right now.',
    };
  }
  if (!isOfferedOpportunityPagePartnerTerm(term)) {
    return {
      ok: false,
      error: 'invalid_term',
      message: 'Choose monthly, 1, 3, 6, or 12 months.',
    };
  }
  return {
    ok: true,
    slotCount: count,
    quote: calculateOpportunityPagePartnerQuote(count, new Date(), term),
  };
}

module.exports = {
  OPPORTUNITY_PAGE_PARTNER_VAT_RATE,
  OPPORTUNITY_PAGE_PARTNER_MONTHLY_PENCE,
  OPPORTUNITY_PAGE_PARTNER_PREPAID_TERMS,
  OPPORTUNITY_PAGE_CAROUSEL_SLOT,
  normalizeOpportunityPagePartnerTerm,
  isOfferedOpportunityPagePartnerTerm,
  addMonthsUtc,
  isPrepaidOpportunityPagePartnerHoldId,
  calculateOpportunityPagePartnerQuote,
  occupancyFromRow,
  getOpportunityPagePartnerAvailability,
  validateOpportunityPagePartnerCheckout,
};
