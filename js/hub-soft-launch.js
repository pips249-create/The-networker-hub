/**
 * Soft-launch dates (client) — keep in sync with api/_lib/soft-launch.js.
 * Browse: 25 Aug 2026 · Tickets & opportunity enquiries: 1 Sep 2026 (Europe/London).
 */
(function (global) {
  var PUBLIC_BROWSE_OPENS_AT = '2026-08-25T00:00:00+01:00';
  var PUBLIC_TRANSACTIONS_OPENS_AT = '2026-09-01T00:00:00+01:00';

  function opensAtMs(iso) {
    var t = Date.parse(iso);
    return isNaN(t) ? 0 : t;
  }

  function isPublicBrowseOpen(nowMs) {
    var now = nowMs == null ? Date.now() : Number(nowMs);
    return now >= opensAtMs(PUBLIC_BROWSE_OPENS_AT);
  }

  function arePublicTicketSalesOpen(nowMs) {
    var now = nowMs == null ? Date.now() : Number(nowMs);
    return now >= opensAtMs(PUBLIC_TRANSACTIONS_OPENS_AT);
  }

  function publicTicketSalesClosedMessage() {
    return 'Ticket buying opens on 1 September 2026. You can browse events now and nudge organisers to list tickets.';
  }

  function arePublicEnquiriesOpen(nowMs) {
    var now = nowMs == null ? Date.now() : Number(nowMs);
    return now >= opensAtMs(PUBLIC_TRANSACTIONS_OPENS_AT);
  }

  function publicEnquiriesClosedMessage() {
    return 'Opportunity enquiries open on 1 September 2026. You can browse listings now and enquire when they go live.';
  }

  function softLaunchPublicMeta(nowMs) {
    var now = nowMs == null ? Date.now() : Number(nowMs);
    return {
      browseOpen: isPublicBrowseOpen(now),
      browseOpensAt: PUBLIC_BROWSE_OPENS_AT,
      ticketSalesOpen: arePublicTicketSalesOpen(now),
      ticketSalesOpensAt: PUBLIC_TRANSACTIONS_OPENS_AT,
      enquiriesOpen: arePublicEnquiriesOpen(now),
      enquiriesOpensAt: PUBLIC_TRANSACTIONS_OPENS_AT,
      transactionsOpensAt: PUBLIC_TRANSACTIONS_OPENS_AT,
    };
  }

  global.HubSoftLaunch = {
    PUBLIC_BROWSE_OPENS_AT: PUBLIC_BROWSE_OPENS_AT,
    PUBLIC_TRANSACTIONS_OPENS_AT: PUBLIC_TRANSACTIONS_OPENS_AT,
    isPublicBrowseOpen: isPublicBrowseOpen,
    arePublicTicketSalesOpen: arePublicTicketSalesOpen,
    publicTicketSalesClosedMessage: publicTicketSalesClosedMessage,
    arePublicEnquiriesOpen: arePublicEnquiriesOpen,
    publicEnquiriesClosedMessage: publicEnquiriesClosedMessage,
    softLaunchPublicMeta: softLaunchPublicMeta,
  };
})(typeof window !== 'undefined' ? window : globalThis);
