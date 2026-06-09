/** Customer-facing booking fee: 4.5% + 20p per ticket (matches event detail UI). */
const BOOKING_FEE_RATE = 0.045;
const BOOKING_FEE_PER_TICKET = 0.2;

function roundMoney(amount) {
  return Math.round(Number(amount) * 100) / 100;
}

function clampQty(qty, maxQty) {
  const q = parseInt(qty, 10);
  if (!Number.isFinite(q) || q < 1) return 1;
  const cap = parseInt(maxQty, 10);
  if (Number.isFinite(cap) && cap > 0) return Math.min(q, cap);
  return Math.min(q, 99);
}

function calculateBookingFee(subtotalPounds, qty, maxQty) {
  const sub = Number(subtotalPounds) || 0;
  const q = clampQty(qty, maxQty);
  return roundMoney(sub * BOOKING_FEE_RATE + BOOKING_FEE_PER_TICKET * q);
}

function calculateCheckoutTotals(unitPricePounds, qty, maxQty) {
  const q = clampQty(qty, maxQty);
  const unit = Number(unitPricePounds) || 0;
  const subtotal = roundMoney(unit * q);
  const fee = calculateBookingFee(subtotal, q);
  const total = roundMoney(subtotal + fee);
  return { subtotal, fee, total, qty: q, unitPrice: unit };
}

module.exports = {
  BOOKING_FEE_RATE,
  BOOKING_FEE_PER_TICKET,
  calculateBookingFee,
  calculateCheckoutTotals,
};
