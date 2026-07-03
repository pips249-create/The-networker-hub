/** Business opportunity directory listing — £25/month ex VAT, 3-month minimum. */

const OPPORTUNITY_LISTING_MONTHLY_EX_VAT_PENCE = 2500;
const OPPORTUNITY_LISTING_VAT_RATE = 0.2;
const OPPORTUNITY_LISTING_MIN_MONTHS = 3;
const OPPORTUNITY_LISTING_MAX_MONTHS = 36;

function normalizeListingMonths(value) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < OPPORTUNITY_LISTING_MIN_MONTHS) {
    return OPPORTUNITY_LISTING_MIN_MONTHS;
  }
  return Math.min(n, OPPORTUNITY_LISTING_MAX_MONTHS);
}

function calculateOpportunityListingTotals(months) {
  const termMonths = normalizeListingMonths(months);
  const subtotalExVatPence = OPPORTUNITY_LISTING_MONTHLY_EX_VAT_PENCE * termMonths;
  const vatPence = Math.round(subtotalExVatPence * OPPORTUNITY_LISTING_VAT_RATE);
  return {
    months: termMonths,
    monthlyExVatPence: OPPORTUNITY_LISTING_MONTHLY_EX_VAT_PENCE,
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
  // Legacy listings published before prepaid terms were introduced.
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
