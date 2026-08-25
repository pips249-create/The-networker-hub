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

  var BANNER_ID = 'hub-browse-week-banner';
  var BANNER_DISMISS_KEY = 'hub_browse_week_banner_dismissed_v1';

  function shouldSkipBrowseWeekBanner() {
    var path = String((global.location && global.location.pathname) || '').toLowerCase();
    if (path.indexOf('/admin') === 0) return true;
    if (path === '/peek' || path.indexOf('/peek/') === 0) return true;
    if (path.indexOf('/site-access') === 0) return true;
    if (path.indexOf('/marketing/') === 0) return true;
    if (path.indexOf('/embed/') === 0) return true;
    try {
      if (global.self !== global.top) return true;
    } catch (e) {
      return true;
    }
    return false;
  }

  /**
   * Quiet site-wide notice while browsing is open but tickets/enquiries are not.
   * Inserts above the shared nav when possible; dismissible until 1 September.
   */
  function mountBrowseWeekBanner(opts) {
    opts = opts || {};
    if (typeof document === 'undefined') return;
    if (shouldSkipBrowseWeekBanner()) return;
    if (!isPublicBrowseOpen() || arePublicTicketSalesOpen()) return;
    try {
      if (global.localStorage && global.localStorage.getItem(BANNER_DISMISS_KEY) === '1') return;
    } catch (e) {
      /* private mode — still show */
    }
    if (document.getElementById(BANNER_ID)) return;

    var banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.className = 'hub-browse-week-banner';
    banner.setAttribute('role', 'status');
    banner.innerHTML =
      '<p class="hub-browse-week-banner-text">' +
      '<strong>Looking around is open</strong>' +
      '<span class="hub-browse-week-banner-sep" aria-hidden="true">·</span>' +
      'Booking &amp; enquiries from <strong>1 September</strong>' +
      '</p>' +
      '<button type="button" class="hub-browse-week-banner-dismiss" aria-label="Dismiss notice">×</button>';

    var beforeEl = opts.beforeEl || document.getElementById('hub-site-nav');
    if (beforeEl && beforeEl.parentNode) {
      beforeEl.parentNode.insertBefore(banner, beforeEl);
    } else if (document.body) {
      document.body.insertBefore(banner, document.body.firstChild);
    } else {
      return;
    }

    document.documentElement.classList.add('has-hub-browse-week-banner');

    var dismiss = banner.querySelector('.hub-browse-week-banner-dismiss');
    if (dismiss) {
      dismiss.addEventListener('click', function () {
        try {
          if (global.localStorage) global.localStorage.setItem(BANNER_DISMISS_KEY, '1');
        } catch (err) {
          /* ignore */
        }
        banner.remove();
        document.documentElement.classList.remove('has-hub-browse-week-banner');
      });
    }
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
    mountBrowseWeekBanner: mountBrowseWeekBanner,
  };
})(typeof window !== 'undefined' ? window : globalThis);
