/**
 * Customer-facing booking fee helpers (4.5% + 20p per ticket).
 * Mirrors api/_lib/booking-fees.js for browse listings and checkout UI.
 */
(function (global) {
  const BOOKING_FEE_RATE = 0.045;
  const BOOKING_FEE_PER_TICKET = 0.2;
  const ORGANISER_VAT_RATE = 0.2;
  const BOOKING_FEE_LABEL = 'Booking fee (4.5% + 20p per ticket)';
  const ORGANISER_VAT_LABEL = 'VAT (20%)';

  function roundMoney(amount) {
    return Math.round(Number(amount) * 100) / 100;
  }

  function clampQty(qty) {
    const q = parseInt(qty, 10);
    return Number.isFinite(q) && q >= 1 ? q : 1;
  }

  function normalizeVatTreatment(raw) {
    const v = String(raw || '')
      .trim()
      .toLowerCase();
    if (v === 'added') return 'added';
    if (v === 'none' || v === 'not_registered' || v === 'not-registered') return 'none';
    return 'included';
  }

  function eventVatTreatment(ev) {
    return normalizeVatTreatment(ev && (ev.vatTreatment || ev.vat_treatment));
  }

  function calculateBookingFee(subtotalPounds, qty) {
    const sub = Number(subtotalPounds) || 0;
    if (sub <= 0) return 0;
    const q = clampQty(qty);
    return roundMoney(sub * BOOKING_FEE_RATE + BOOKING_FEE_PER_TICKET * q);
  }

  function calculateCheckoutTotals(unitPricePounds, qty, vatTreatment) {
    const q = clampQty(qty);
    const unit = Number(unitPricePounds) || 0;
    const subtotal = roundMoney(unit * q);
    const treatment = normalizeVatTreatment(vatTreatment);
    const vat = treatment === 'added' && subtotal > 0 ? roundMoney(subtotal * ORGANISER_VAT_RATE) : 0;
    const fee = calculateBookingFee(subtotal, q);
    const total = roundMoney(subtotal + vat + fee);
    return {
      subtotal: subtotal,
      vat: vat,
      fee: fee,
      total: total,
      qty: q,
      unitPrice: unit,
      vatTreatment: treatment,
      organiserGross: roundMoney(subtotal + vat),
    };
  }

  function listingPriceNum(ev) {
    if (!ev || ev.priceKey === 'free' || /^free$/i.test(String(ev.price || ''))) return 0;
    const ticketPrice = Number(ev.priceNum);
    if (!Number.isFinite(ticketPrice) || ticketPrice <= 0) return 0;
    return calculateCheckoutTotals(ticketPrice, 1, eventVatTreatment(ev)).total;
  }

  function formatPounds(amount) {
    const n = Number(amount) || 0;
    if (n <= 0) return 'Free';
    return n % 1 === 0 ? '£' + n.toFixed(0) : '£' + n.toFixed(2);
  }

  function guestVisitTrialSuffix(ev, options) {
    const opts = options || {};
    if (ev.guestPassesDisabled) return '';
    const allowed = Number(ev.complimentaryVisitsAllowed) || 0;
    if (allowed < 1) return '';

    const eligibility = opts.guestVisitEligibility || null;
    if (eligibility && eligibility.isRosterMember) return '';
    if (eligibility && eligibility.signedOut) {
      return allowed === 1 ? 'up to 1 free visit' : 'up to ' + allowed + ' free visits';
    }
    if (eligibility && eligibility.eligible === true && Number.isFinite(Number(eligibility.remaining))) {
      const remaining = Math.max(0, Number(eligibility.remaining) || 0);
      if (remaining < 1) return '';
      return remaining === 1 ? '1 free visit left' : remaining + ' free visits left';
    }

    if (opts.guestVisitRemaining != null && Number.isFinite(Number(opts.guestVisitRemaining))) {
      const remaining = Math.max(0, Number(opts.guestVisitRemaining) || 0);
      if (remaining < 1) return '';
      return remaining === 1 ? '1 free visit left' : remaining + ' free visits left';
    }

    // Public browse copy: organiser allowance, not the viewer's remaining balance.
    return allowed === 1 ? 'up to 1 free visit' : 'up to ' + allowed + ' free visits';
  }

  function isMembersOnlyListing(ev) {
    const mode = String(ev?.attendanceMode || '').trim();
    if (mode === 'category_exclusivity' || mode === 'osop') return false;
    return Boolean(ev?.isMembersOnlyEvent);
  }

  function listingShowsFrom(ev, options) {
    const opts = options || {};
    if (opts.withFrom === true) return true;
    if (opts.withFrom === false) return false;
    if (ev && typeof ev.priceVaries === 'boolean') return Boolean(ev.priceVaries);
    const tickets = ev && Array.isArray(ev.tickets) ? ev.tickets : null;
    if (tickets && tickets.length) {
      const paidCents = tickets
        .filter(function (t) {
          return !t.isGuestVisit && !t.isAlumni && !t.isMembersOnly;
        })
        .map(function (t) {
          return Math.round((Number(t.priceNum) || 0) * 100);
        })
        .filter(function (c) {
          return c > 0;
        });
      return new Set(paidCents).size > 1;
    }
    return false;
  }

  function listingPriceLabel(ev, options) {
    const opts = options || {};
    const withFrom = listingShowsFrom(ev, opts);
    if (isMembersOnlyListing(ev)) {
      return 'Members only';
    }
    if (
      String(ev?.attendanceMode || '') === 'guest_programme' ||
      String(ev?.attendanceMode || '') === 'membership_meeting'
    ) {
      const member =
        ev.priceKey === 'free' || /^free$/i.test(String(ev.price || ''))
          ? 'Free'
          : withFrom
            ? 'from ' + formatPounds(listingPriceNum(ev))
            : formatPounds(listingPriceNum(ev));
      const trial = guestVisitTrialSuffix(ev, opts);
      return trial ? member + ' · ' + trial : member;
    }
    if (!ev || ev.priceKey === 'free' || /^free$/i.test(String(ev.price || ''))) {
      return 'Free';
    }
    const total = listingPriceNum(ev);
    if (total <= 0) return String(ev.price || 'Free');
    const formatted = formatPounds(total);
    return withFrom ? 'from ' + formatted : formatted;
  }

  global.HubBookingFees = {
    BOOKING_FEE_RATE: BOOKING_FEE_RATE,
    BOOKING_FEE_PER_TICKET: BOOKING_FEE_PER_TICKET,
    ORGANISER_VAT_RATE: ORGANISER_VAT_RATE,
    BOOKING_FEE_LABEL: BOOKING_FEE_LABEL,
    ORGANISER_VAT_LABEL: ORGANISER_VAT_LABEL,
    normalizeVatTreatment: normalizeVatTreatment,
    eventVatTreatment: eventVatTreatment,
    calculateBookingFee: calculateBookingFee,
    calculateCheckoutTotals: calculateCheckoutTotals,
    listingPriceNum: listingPriceNum,
    formatPounds: formatPounds,
    listingShowsFrom: listingShowsFrom,
    listingPriceLabel: listingPriceLabel,
  };
})(typeof window !== 'undefined' ? window : globalThis);
