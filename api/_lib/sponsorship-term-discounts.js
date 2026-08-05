/**
 * Shared prepaid-term discounts for sponsorship / featured boosts.
 * Monthly and 1-month prepaid stay full rate; longer terms get a modest lock-in incentive.
 */
const PREPAID_TERM_DISCOUNT_PERCENT = {
  3: 5,
  6: 10,
  12: 15,
};

function prepaidTermDiscountPercent(termMonths) {
  const n = Math.floor(Number(termMonths) || 0);
  return PREPAID_TERM_DISCOUNT_PERCENT[n] || 0;
}

/**
 * @param {number} listPence — full-price amount before discount
 * @param {number|null|undefined} termMonths
 * @returns {{ listPence: number, discountPercent: number, discountPence: number, netPence: number }}
 */
function applyPrepaidTermDiscount(listPence, termMonths) {
  const list = Math.max(0, Math.round(Number(listPence) || 0));
  const discountPercent = prepaidTermDiscountPercent(termMonths);
  const discountPence = Math.round((list * discountPercent) / 100);
  return {
    listPence: list,
    discountPercent,
    discountPence,
    netPence: Math.max(0, list - discountPence),
  };
}

module.exports = {
  PREPAID_TERM_DISCOUNT_PERCENT,
  prepaidTermDiscountPercent,
  applyPrepaidTermDiscount,
};
