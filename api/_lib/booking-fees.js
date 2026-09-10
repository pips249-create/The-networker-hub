/**
 * Customer-facing booking fee: 4.5% + 20p per ticket.
 * This is the merged Hub fee (3% platform + ~1.5% Stripe + 20p per ticket on the ticket price).
 * Organisers receive the full ticket price (and organiser VAT when treatment is "added");
 * attendees pay the booking fee on top.
 *
 * Hub net revenue is the 3% platform portion only — Stripe processing (~1.5% + 20p)
 * is absorbed from the booking fee and must not be counted as Hub income.
 */
const BOOKING_FEE_RATE = 0.045;
const BOOKING_FEE_PER_TICKET = 0.2;
/** Hub platform cut of ticket/membership subtotal (excludes Stripe). */
const PLATFORM_FEE_RATE = 0.03;
/** Organiser VAT rate when event vat_treatment is "added". */
const ORGANISER_VAT_RATE = 0.2;

const BOOKING_FEE_LABEL = 'Booking fee (4.5% + 20p per ticket)';
const BOOKING_FEE_EXPLANATION =
  'The booking fee covers platform and payment processing. Organisers receive the full ticket price.';
const BOOKING_FEE_NON_REFUNDABLE_NOTE =
  'The Networker UK booking fee (platform fee) is non-refundable.';
const ORGANISER_VAT_LABEL = 'VAT (20%)';

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

function normalizeVatTreatment(raw) {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  if (v === 'added') return 'added';
  if (v === 'none' || v === 'not_registered' || v === 'not-registered') return 'none';
  return 'included';
}

function calculateBookingFee(subtotalPounds, qty, maxQty) {
  const sub = Number(subtotalPounds) || 0;
  if (sub <= 0) return 0;
  const q = clampQty(qty, maxQty);
  return roundMoney(sub * BOOKING_FEE_RATE + BOOKING_FEE_PER_TICKET * q);
}

/**
 * @param {number} unitPricePounds ticket face price (organiser list price)
 * @param {number} qty
 * @param {number} [maxQty]
 * @param {string} [vatTreatment] included | added | none
 */
function calculateCheckoutTotals(unitPricePounds, qty, maxQty, vatTreatment) {
  const q = clampQty(qty, maxQty);
  const unit = Number(unitPricePounds) || 0;
  const subtotal = roundMoney(unit * q);
  const treatment = normalizeVatTreatment(vatTreatment);
  const vat = treatment === 'added' && subtotal > 0 ? roundMoney(subtotal * ORGANISER_VAT_RATE) : 0;
  const fee = calculateBookingFee(subtotal, q);
  const total = roundMoney(subtotal + vat + fee);
  return {
    subtotal,
    vat,
    fee,
    total,
    qty: q,
    unitPrice: unit,
    vatTreatment: treatment,
    organiserGross: roundMoney(subtotal + vat),
  };
}

function tryDecomposeCheckoutTotal(paid, qty, withVat) {
  const q = clampQty(qty);
  const mult = withVat ? 1 + ORGANISER_VAT_RATE : 1;
  const subtotal = roundMoney((paid - BOOKING_FEE_PER_TICKET * q) / (mult + BOOKING_FEE_RATE));
  if (subtotal < 0) {
    return { subtotal: 0, vat: 0, fee: 0, total: 0, match: paid <= 0 };
  }
  const vat = withVat ? roundMoney(subtotal * ORGANISER_VAT_RATE) : 0;
  const fee = calculateBookingFee(subtotal, q);
  const total = roundMoney(subtotal + vat + fee);
  return {
    subtotal,
    vat,
    fee,
    total,
    match: Math.abs(total - paid) < 0.02,
  };
}

/**
 * Split a paid checkout total back into ticket / VAT / fee.
 * Prefers the event's VAT treatment, but falls back when historical charges
 * did not include organiser VAT yet (treatment was "added" in copy only).
 */
function decomposeCheckoutTotal(checkoutTotal, qty, maxQty, vatTreatment) {
  const paid = Number(checkoutTotal) || 0;
  const q = clampQty(qty, maxQty);
  if (paid <= 0) {
    return { subtotal: 0, vat: 0, fee: 0, total: 0, qty: q };
  }
  const treatment = normalizeVatTreatment(vatTreatment);
  const preferVat = treatment === 'added';
  const primary = tryDecomposeCheckoutTotal(paid, q, preferVat);
  if (primary.match) {
    return { ...primary, qty: q, vatTreatment: treatment };
  }
  const fallback = tryDecomposeCheckoutTotal(paid, q, !preferVat);
  if (fallback.match) {
    return { ...fallback, qty: q, vatTreatment: treatment };
  }
  return { ...primary, qty: q, vatTreatment: treatment };
}

/** Ticket face subtotal from checkout total (organiser ticket revenue before VAT). */
function ticketSubtotalFromCheckoutTotal(checkoutTotal, qty, maxQty, vatTreatment) {
  return decomposeCheckoutTotal(checkoutTotal, qty, maxQty, vatTreatment).subtotal;
}

function bookingFeeFromCheckoutTotal(checkoutTotal, qty, maxQty, vatTreatment) {
  const parts = decomposeCheckoutTotal(checkoutTotal, qty, maxQty, vatTreatment);
  if (parts.subtotal <= 0) return 0;
  return parts.fee;
}

function parseKnownTicketUnit(registration) {
  const candidates = [
    registration?.ticket_unit_price,
    registration?.ticket_price_num,
    registration?.ticketPriceNum,
    registration?.ticket_price,
    registration?.ticketPrice,
    registration?.ticket?.price,
    registration?.ticket?.priceNum,
  ];
  for (const raw of candidates) {
    if (raw == null || raw === '') continue;
    const n = Number(String(raw).replace(/[£,\s]/g, ''));
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

function registrationVatTreatment(registration) {
  const raw =
    registration?.vat_treatment ??
    registration?.vatTreatment ??
    registration?.event_vat_treatment ??
    registration?.eventVatTreatment;
  if (raw == null || raw === '') return null;
  return normalizeVatTreatment(raw);
}

function registrationTicketRevenue(registration) {
  const paid = Number(registration?.amount_paid || 0);
  if (paid <= 0) return 0;
  const qty = Math.max(1, parseInt(registration?.quantity, 10) || 1);
  const treatment = registrationVatTreatment(registration);
  const knownUnit = parseKnownTicketUnit(registration);

  if (knownUnit != null) {
    const tryOrder =
      treatment != null
        ? [treatment, treatment === 'added' ? 'included' : 'added']
        : ['included', 'added'];
    for (const t of tryOrder) {
      const totals = calculateCheckoutTotals(knownUnit, qty, undefined, t);
      if (Math.abs(totals.total - paid) < 0.05) {
        return totals.organiserGross;
      }
    }
  }

  // Legacy reverse: only assume organiser VAT when the registration/event says so.
  // Avoid guessing — ticket+fee and ticket+VAT+fee can both reconcile for some totals.
  const parts = tryDecomposeCheckoutTotal(paid, qty, treatment === 'added');
  return roundMoney(parts.subtotal + parts.vat);
}

function registrationBookingFee(registration) {
  const paid = Number(registration?.amount_paid || 0);
  if (paid <= 0) return 0;
  const ticketAndVat = registrationTicketRevenue(registration);
  return roundMoney(Math.max(0, paid - ticketAndVat));
}

/** Hub net income from a ticket/membership subtotal (3% — Stripe excluded). */
function calculateHubPlatformFee(subtotalPounds) {
  const sub = Number(subtotalPounds) || 0;
  if (sub <= 0) return 0;
  return roundMoney(sub * PLATFORM_FEE_RATE);
}

/** Hub net income from a paid registration (excludes Stripe portion of booking fee). */
function registrationHubPlatformFee(registration) {
  const paid = Number(registration?.amount_paid || 0);
  if (paid <= 0) return 0;
  const qty = Math.max(1, parseInt(registration?.quantity, 10) || 1);
  const treatment = registrationVatTreatment(registration);
  const knownUnit = parseKnownTicketUnit(registration);
  if (knownUnit != null) {
    const tryOrder =
      treatment != null
        ? [treatment, treatment === 'added' ? 'included' : 'added']
        : ['included', 'added'];
    for (const t of tryOrder) {
      const totals = calculateCheckoutTotals(knownUnit, qty, undefined, t);
      if (Math.abs(totals.total - paid) < 0.05) {
        return calculateHubPlatformFee(totals.subtotal);
      }
    }
  }
  const parts = tryDecomposeCheckoutTotal(paid, qty, treatment === 'added');
  return calculateHubPlatformFee(parts.subtotal);
}

module.exports = {
  BOOKING_FEE_RATE,
  BOOKING_FEE_PER_TICKET,
  PLATFORM_FEE_RATE,
  ORGANISER_VAT_RATE,
  BOOKING_FEE_LABEL,
  BOOKING_FEE_EXPLANATION,
  BOOKING_FEE_NON_REFUNDABLE_NOTE,
  ORGANISER_VAT_LABEL,
  roundMoney,
  normalizeVatTreatment,
  calculateBookingFee,
  calculateCheckoutTotals,
  calculateHubPlatformFee,
  decomposeCheckoutTotal,
  ticketSubtotalFromCheckoutTotal,
  bookingFeeFromCheckoutTotal,
  registrationTicketRevenue,
  registrationBookingFee,
  registrationHubPlatformFee,
};
