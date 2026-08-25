/**
 * Analytics after cookie consent — Vercel Web Analytics + Google Analytics 4.
 * Custom Vercel events: https://vercel.com/docs/analytics/custom-events
 */
(function () {
  var enabled = false;
  /** Hub GA4 property for www.thenetworkeruk.com (not the-networker.co.uk). */
  var GA4_MEASUREMENT_ID = 'G-5R35MYN6EX';

  function hasConsent() {
    if (window.HubCookieConsent && typeof window.HubCookieConsent.hasAnalyticsConsent === 'function') {
      return window.HubCookieConsent.hasAnalyticsConsent();
    }
    return false;
  }

  function ensureVaStub() {
    if (!window.va) {
      window.va = function () {
        if (!enabled) return;
        (window.vaq = window.vaq || []).push(arguments);
      };
    }
  }

  function loadGa4() {
    if (!GA4_MEASUREMENT_ID) return;
    if (document.head.querySelector('script[src*="googletagmanager.com/gtag/js"]')) return;

    window.dataLayer = window.dataLayer || [];
    window.gtag =
      window.gtag ||
      function () {
        window.dataLayer.push(arguments);
      };
    window.gtag('js', new Date());
    window.gtag('config', GA4_MEASUREMENT_ID, {
      anonymize_ip: true,
    });

    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4_MEASUREMENT_ID);
    document.head.appendChild(s);
  }

  /**
   * Track a custom event for the Vercel Analytics dashboard.
   * Pro plan allows at most 2 custom data keys; values must be string/number/boolean/null.
   */
  function track(name, data) {
    if (!enabled || !hasConsent()) return;
    var eventName = String(name || '').trim().slice(0, 255);
    if (!eventName) return;
    ensureVaStub();
    var cleaned = {};
    if (data && typeof data === 'object') {
      var keys = Object.keys(data);
      for (var i = 0; i < keys.length && Object.keys(cleaned).length < 2; i++) {
        var key = String(keys[i]).slice(0, 255);
        var val = data[key];
        if (val == null) cleaned[key] = null;
        else if (typeof val === 'string') cleaned[key] = val.slice(0, 255);
        else if (typeof val === 'number' || typeof val === 'boolean') cleaned[key] = val;
        else cleaned[key] = String(val).slice(0, 255);
      }
    }
    var payload = { name: eventName };
    if (Object.keys(cleaned).length) payload.data = cleaned;
    try {
      window.va('event', payload);
    } catch (e) {
      /* analytics optional */
    }
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, Object.keys(cleaned).length ? cleaned : undefined);
      }
    } catch (e2) {
      /* analytics optional */
    }
  }

  window.HubAnalytics = {
    loaded: false,
    measurementId: GA4_MEASUREMENT_ID,
    track: track,
    load: function () {
      if (this.loaded || !hasConsent()) return;
      enabled = true;
      var host = String(window.location.hostname || '').toLowerCase();
      if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
        this.loaded = true;
        return;
      }
      this.loaded = true;
      ensureVaStub();
      loadGa4();
      var insightsSrc = '/_vercel/insights/script.js';
      if (document.head.querySelector('script[src*="insights/script.js"]')) return;
      var insights = document.createElement('script');
      insights.src = insightsSrc;
      insights.defer = true;
      insights.dataset.sdkn = '@vercel/analytics';
      insights.dataset.sdkv = '2.0.1';
      insights.onerror = function () {
        /* non-fatal — analytics optional in preview/local */
      };
      document.head.appendChild(insights);
    },
    /** Stop further events after consent withdrawal (script already in page cannot be fully unloaded). */
    disable: function () {
      enabled = false;
      try {
        window.vaq = [];
      } catch (e) {
        /* ignore */
      }
    },
  };
})();
