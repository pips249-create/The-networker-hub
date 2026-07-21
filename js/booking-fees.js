/**
 * Customer-facing booking fee helpers (4.5% + 20p per ticket).
 * Mirrors api/_lib/booking-fees.js for browse listings and checkout UI.
 */
(function (global) {
  const BOOKING_FEE_RATE = 0.045;
  const BOOKING_FEE_PER_TICKET = 0.2;

  function roundMoney(amount) {
    return Math.round(Number(amount) * 100) / 100;
  }

  function clampQty(qty) {
    const q = parseInt(qty, 10);
    return Number.isFinite(q) && q >= 1 ? q : 1;
  }

  function calculateBookingFee(subtotalPounds, qty) {
    const sub = Number(subtotalPounds) || 0;
    if (sub <= 0) return 0;
    const q = clampQty(qty);
    return roundMoney(sub * BOOKING_FEE_RATE + BOOKING_FEE_PER_TICKET * q);
  }

  function calculateCheckoutTotals(unitPricePounds, qty) {
    const q = clampQty(qty);
    const unit = Number(unitPricePounds) || 0;
    const subtotal = roundMoney(unit * q);
    const fee = calculateBookingFee(subtotal, q);
    const total = roundMoney(subtotal + fee);
    return { subtotal: subtotal, fee: fee, total: total, qty: q, unitPrice: unit };
  }

  function listingPriceNum(ev) {
    if (!ev || ev.priceKey === 'free' || /^free$/i.test(String(ev.price || ''))) return 0;
    const ticketPrice = Number(ev.priceNum);
    if (!Number.isFinite(ticketPrice) || ticketPrice <= 0) return 0;
    return calculateCheckoutTotals(ticketPrice, 1).total;
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
      return allowed === 1 ? 'up to 1 complimentary visit' : 'up to ' + allowed + ' complimentary visits';
    }
    if (eligibility && eligibility.eligible === true && Number.isFinite(Number(eligibility.remaining))) {
      const remaining = Math.max(0, Number(eligibility.remaining) || 0);
      if (remaining < 1) return '';
      return remaining === 1 ? '1 complimentary visit left' : remaining + ' complimentary visits left';
    }

    if (opts.guestVisitRemaining != null && Number.isFinite(Number(opts.guestVisitRemaining))) {
      const remaining = Math.max(0, Number(opts.guestVisitRemaining) || 0);
      if (remaining < 1) return '';
      return remaining === 1 ? '1 complimentary visit left' : remaining + ' complimentary visits left';
    }

    // Public browse copy: organiser allowance, not the viewer's remaining balance.
    return allowed === 1 ? 'up to 1 complimentary visit' : 'up to ' + allowed + ' complimentary visits';
  }

  function isMembersOnlyListing(ev) {
    return Boolean(
      ev?.isMembersOnlyEvent || (ev?.hasMembersOnlyTiers && !(ev?.tickets || []).length)
    );
  }

  function listingPriceLabel(ev, options) {
    const opts = options || {};
    const withFrom = opts.withFrom !== false;
    if (isMembersOnlyListing(ev)) {
      return 'Members only';
    }
    if (String(ev?.attendanceMode || '') === 'guest_programme') {
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
    calculateBookingFee: calculateBookingFee,
    calculateCheckoutTotals: calculateCheckoutTotals,
    listingPriceNum: listingPriceNum,
    formatPounds: formatPounds,
    listingPriceLabel: listingPriceLabel,
  };
})(typeof window !== 'undefined' ? window : globalThis);
