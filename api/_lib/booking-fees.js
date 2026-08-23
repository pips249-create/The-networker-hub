/**
 * Customer-facing booking fee: 4.5% + 20p per ticket.
 * This is the merged Hub fee (3% platform + ~1.5% Stripe + 20p per ticket on the ticket price).
 * Organisers receive the full ticket price; attendees pay the booking fee on top.
 *
 * Hub net revenue is the 3% platform portion only — Stripe processing (~1.5% + 20p)
 * is absorbed from the booking fee and must not be counted as Hub income.
 */
const BOOKING_FEE_RATE = 0.045;
const BOOKING_FEE_PER_TICKET = 0.2;
/** Hub platform cut of ticket/membership subtotal (excludes Stripe). */
const PLATFORM_FEE_RATE = 0.03;

const BOOKING_FEE_LABEL = 'Booking fee (4.5% + 20p per ticket)';
const BOOKING_FEE_EXPLANATION =
  'The booking fee covers platform and payment processing. Organisers receive the full ticket price.';
const BOOKING_FEE_NON_REFUNDABLE_NOTE =
  'The Networker UK booking fee (platform fee) is non-refundable.';

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
  if (sub <= 0) return 0;
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

/** Ticket subtotal from checkout total (organiser revenue per registration). */
function ticketSubtotalFromCheckoutTotal(checkoutTotal, qty, maxQty) {
  const paid = Number(checkoutTotal) || 0;
  const q = clampQty(qty, maxQty);
  if (paid <= 0) return 0;
  const subtotal = (paid - BOOKING_FEE_PER_TICKET * q) / (1 + BOOKING_FEE_RATE);
  return roundMoney(Math.max(0, subtotal));
}

function bookingFeeFromCheckoutTotal(checkoutTotal, qty, maxQty) {
  const subtotal = ticketSubtotalFromCheckoutTotal(checkoutTotal, qty, maxQty);
  if (subtotal <= 0) return 0;
  return calculateBookingFee(subtotal, qty, maxQty);
}

function registrationTicketRevenue(registration) {
  const paid = Number(registration?.amount_paid || 0);
  if (paid <= 0) return 0;
  const qty = Math.max(1, parseInt(registration?.quantity, 10) || 1);
  return ticketSubtotalFromCheckoutTotal(paid, qty);
}

function registrationBookingFee(registration) {
  const paid = Number(registration?.amount_paid || 0);
  if (paid <= 0) return 0;
  const ticket = registrationTicketRevenue(registration);
  return roundMoney(Math.max(0, paid - ticket));
}

/** Hub net income from a ticket/membership subtotal (3% — Stripe excluded). */
function calculateHubPlatformFee(subtotalPounds) {
  const sub = Number(subtotalPounds) || 0;
  if (sub <= 0) return 0;
  return roundMoney(sub * PLATFORM_FEE_RATE);
}

/** Hub net income from a paid registration (excludes Stripe portion of booking fee). */
function registrationHubPlatformFee(registration) {
  return calculateHubPlatformFee(registrationTicketRevenue(registration));
}

module.exports = {
  BOOKING_FEE_RATE,
  BOOKING_FEE_PER_TICKET,
  PLATFORM_FEE_RATE,
  BOOKING_FEE_LABEL,
  BOOKING_FEE_EXPLANATION,
  BOOKING_FEE_NON_REFUNDABLE_NOTE,
  calculateBookingFee,
  calculateCheckoutTotals,
  calculateHubPlatformFee,
  ticketSubtotalFromCheckoutTotal,
  bookingFeeFromCheckoutTotal,
  registrationTicketRevenue,
  registrationBookingFee,
  registrationHubPlatformFee,
};
