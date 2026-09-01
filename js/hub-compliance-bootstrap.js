/**
 * Shared PECR compliance assets — Sentry + cookie consent + gated analytics.
 * Loaded by site-nav.js and standalone pages without the main nav.
 */
(function () {
  var BUILD = '20260901cmp2';
  var FONT_SAFE = 'js/hub-fonts-safe.js?v=20260828fonts1';

  function ensureFontSafety(root) {
    if (window.__hubFontsSafe) return;
    if (document.querySelector('[data-hub-compliance="' + FONT_SAFE + '"]')) return;
    var s = document.createElement('script');
    s.src = (root || '') + FONT_SAFE;
    s.setAttribute('data-hub-compliance', FONT_SAFE);
    document.head.appendChild(s);
  }

  function isEmbedContext() {
    try {
      if (new URLSearchParams(window.location.search).get('embed') === '1') return true;
      if (window.self !== window.top) return true;
    } catch (e) {
      return true;
    }
    return false;
  }

  function loadAsset(root, path, options) {
    options = options || {};
    var full = root + path;
    if (document.querySelector('[data-hub-compliance="' + path + '"]')) return;
    if (path.indexOf('.css') !== -1) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = full;
      link.setAttribute('data-hub-compliance', path);
      document.head.appendChild(link);
      return;
    }
    var s = document.createElement('script');
    s.src = full;
    if (options.defer !== false) s.defer = true;
    s.setAttribute('data-hub-compliance', path);
    document.head.appendChild(s);
  }

  function load(root, options) {
    root = root || '';
    options = options || {};
    if (window.__hubComplianceAssets) return;
    window.__hubComplianceAssets = true;

    var embed = options.embed === true || (options.embed !== false && isEmbedContext());

    ensureFontSafety(root);
    loadAsset(root, 'js/hub-sentry.js?v=20260901sentry6', { defer: false });

    if (embed) {
      window.HubCookieConsent = window.HubCookieConsent || {
        openSettings: function () {},
        getConsent: function () {
          return null;
        },
        hasAnalyticsConsent: function () {
          return false;
        },
      };
      return;
    }

    loadAsset(root, 'css/cookie-consent.css?v=20260609');
    loadAsset(root, 'js/hub-analytics.js?v=20260825ga4');
    loadAsset(root, 'js/cookie-consent.js?v=' + BUILD);
  }

  window.HubComplianceBootstrap = { load: load };

  var script = document.currentScript;
  if (script && /hub-compliance-bootstrap/.test(String(script.src || ''))) {
    load(script.getAttribute('data-root') || '', {
      embed: script.getAttribute('data-embed') === '1',
    });
  }
})();
