/**
 * Client-side featured placement duration preview — mirrors api/_lib/event-featured-plans.js.
 */
(function (global) {
  var PLAN_DAYS = { '1month': 30, '1week': 7, '2months': 60, '4weeks': 30 };
  var PLAN_LABELS = {
    '1week': '1 week',
    '1month': '1 month',
    '4weeks': '1 month',
    '2months': '2 months',
  };

  function normalizePlanId(planId) {
    var key = String(planId || '').trim().toLowerCase();
    if (!key) return '1month';
    if (key === '4weeks') return '1month';
    return PLAN_DAYS[key] ? key : '1month';
  }

  function planDays(planId) {
    return PLAN_DAYS[normalizePlanId(planId)] || 30;
  }

  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  function computeFeaturedUntilIso(currentUntil, days, eventStartIso) {
    var now = Date.now();
    var base = now;
    if (currentUntil) {
      var existing = new Date(currentUntil).getTime();
      if (!Number.isNaN(existing) && existing > now) base = existing;
    }
    var untilMs = base + days * 86400000;
    if (eventStartIso) {
      var startMs = new Date(eventStartIso).getTime();
      if (!Number.isNaN(startMs) && startMs > now && startMs < untilMs) untilMs = startMs;
    }
    return new Date(untilMs).toISOString();
  }

  function previewPlacement(opts) {
    opts = opts || {};
    var planId = normalizePlanId(opts.planId);
    var days = planDays(planId);
    var eventStartIso = opts.eventStartIso || opts.date || null;
    var currentUntil = opts.currentUntil || opts.featuredUntil || null;
    var now = Date.now();
    var base = now;
    if (currentUntil) {
      var existing = new Date(currentUntil).getTime();
      if (!Number.isNaN(existing) && existing > now) base = existing;
    }
    var plannedUntilMs = base + days * 86400000;
    var featuredUntil = computeFeaturedUntilIso(currentUntil, days, eventStartIso);
    var startMs = eventStartIso ? new Date(eventStartIso).getTime() : NaN;
    var cappedByEvent =
      Number.isFinite(startMs) && startMs > now && startMs < plannedUntilMs;

    return {
      featuredUntil: featuredUntil,
      cappedByEvent: cappedByEvent,
      planLabel: PLAN_LABELS[planId] || '1 month',
    };
  }

  function checkoutDurationNote(opts) {
    if (opts.quote && opts.quote.pricingNote) {
      return opts.quote.pricingNote;
    }
    var preview = previewPlacement(opts);
    if (!preview.cappedByEvent) {
      return (
        'Featured placement runs for up to ' +
        preview.planLabel +
        ' for people browsing your area and dates on the hub.'
      );
    }
    var eventDate = formatDate(opts.eventStartIso || opts.date);
    return (
      'Your event is on ' +
      eventDate +
      ' — featured placement runs until then, when it leaves the browse page (not the full ' +
      preview.planLabel +
      ').'
    );
  }

  function successStatusText(opts) {
    var preview = previewPlacement(opts);
    var untilDate = formatDate(opts.featuredUntil || preview.featuredUntil);
    if (opts.cappedByEvent != null ? opts.cappedByEvent : preview.cappedByEvent) {
      return (
        'Premium spotlight placement is active until your event starts on ' +
        untilDate +
        '. Thank you!'
      );
    }
    return (
      'Premium spotlight placement is active for up to ' +
      preview.planLabel +
      '. Featured until ' +
      untilDate +
      '. Thank you!'
    );
  }

  global.HubOrganiserFeaturedDuration = {
    previewPlacement: previewPlacement,
    checkoutDurationNote: checkoutDurationNote,
    successStatusText: successStatusText,
    formatDate: formatDate,
  };
})(typeof window !== 'undefined' ? window : globalThis);
