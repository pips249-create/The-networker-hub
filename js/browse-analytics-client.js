/**
 * Shared anonymised browse search/filter logging (consent-gated).
 * Used by events, organisers, and opportunities browse pages.
 */
(function (global) {
  var ANALYTICS_PATH = '/api/browse-analytics';
  var lastLoggedSignature = '';
  var lastLoggedAt = 0;

  function hasAnalyticsConsent() {
    if (global.HubCookieConsent && typeof global.HubCookieConsent.hasAnalyticsConsent === 'function') {
      return global.HubCookieConsent.hasAnalyticsConsent();
    }
    return false;
  }

  function logBrowseSearch(payload) {
    try {
      if (!hasAnalyticsConsent()) return;
      var body = payload && typeof payload === 'object' ? payload : {};
      var source = String(body.source || 'events_browse').trim() || 'events_browse';
      var resultCount = Number(body.resultCount) || 0;
      var signature =
        source +
        '|' +
        String(body.q || '') +
        '|' +
        String(body.location || '') +
        '|' +
        String(body.regionSlug || body.region || '') +
        '|' +
        String(body.types || '') +
        '|' +
        String(body.tab || '') +
        '|' +
        String(body.category || '') +
        '|' +
        String(body.invest || '') +
        '|' +
        String(body.commitment || '') +
        '|' +
        String(body.sort || '') +
        '|' +
        String(resultCount);
      var now = Date.now();
      if (signature === lastLoggedSignature && now - lastLoggedAt < 15000) return;
      lastLoggedSignature = signature;
      lastLoggedAt = now;

      fetch(ANALYTICS_PATH, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          Object.assign(
            {
              action: 'record_search',
              source: source,
              resultCount: resultCount,
            },
            body
          )
        ),
        keepalive: true,
      }).catch(function () {});
    } catch (e) {
      /* ignore analytics failures */
    }
  }

  global.HubBrowseAnalytics = {
    logSearch: logBrowseSearch,
    hasConsent: hasAnalyticsConsent,
  };
})(typeof window !== 'undefined' ? window : globalThis);
