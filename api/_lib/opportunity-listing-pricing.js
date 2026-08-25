/** Business opportunity directory listing — £25/month + VAT, monthly Stripe subscription. */

const OPPORTUNITY_LISTING_MONTHLY_EX_VAT_PENCE = 2500;
const OPPORTUNITY_LISTING_VAT_RATE = 0.2;
/** @deprecated Prepaid terms removed — kept for legacy row display / migrations. */
const OPPORTUNITY_LISTING_MIN_MONTHS = 1;
const OPPORTUNITY_LISTING_MAX_MONTHS = 36;

function normalizeListingMonths(value) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, OPPORTUNITY_LISTING_MAX_MONTHS);
}

/** Monthly subscription totals (one billing period). */
function calculateOpportunityListingTotals(months) {
  const termMonths = 1;
  void months;
  const subtotalExVatPence = OPPORTUNITY_LISTING_MONTHLY_EX_VAT_PENCE * termMonths;
  const vatPence = Math.round(subtotalExVatPence * OPPORTUNITY_LISTING_VAT_RATE);
  return {
    months: termMonths,
    billingMode: 'subscription',
    monthlyExVatPence: OPPORTUNITY_LISTING_MONTHLY_EX_VAT_PENCE,
    monthlyVatPence: vatPence,
    subtotalExVatPence,
    vatPence,
    totalPence: subtotalExVatPence + vatPence,
  };
}

function addMonths(baseDate, months) {
  const d = new Date(baseDate);
  d.setMonth(d.getMonth() + months);
  return d;
}

function listingPaymentCurrent(row) {
  if (!row) return false;
  if (row.listing_expires_at) {
    return new Date(row.listing_expires_at).getTime() > Date.now();
  }
  // Legacy listings published before prepaid/subscription terms were introduced.
  if (String(row.status || '').toLowerCase() === 'published' && row.published_at) {
    return true;
  }
  return false;
}

module.exports = {
  OPPORTUNITY_LISTING_MONTHLY_EX_VAT_PENCE,
  OPPORTUNITY_LISTING_VAT_RATE,
  OPPORTUNITY_LISTING_MIN_MONTHS,
  OPPORTUNITY_LISTING_MAX_MONTHS,
  normalizeListingMonths,
  calculateOpportunityListingTotals,
  addMonths,
  listingPaymentCurrent,
};
