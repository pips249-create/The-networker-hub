/**
 * Partner programme — capture ?ref= / ?code= into a 30-day first-party cookie
 * and beacon a click when the code arrives via the URL (not cookie-only pageviews).
 */
(function (global) {
  var COOKIE_NAME = 'tnu_aff_ref';
  var COOKIE_DAYS = 30;
  var CLICK_DEDUP_MS = 30 * 60 * 1000;

  function normalizeCode(raw) {
    var code = String(raw || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '');
    if (code.length < 2 || code.length > 32) return '';
    if (!/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(code)) return '';
    return code;
  }

  function readCookie(name) {
    var parts = String(document.cookie || '').split(';');
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].trim();
      if (part.indexOf(name + '=') === 0) {
        return decodeURIComponent(part.slice(name.length + 1));
      }
    }
    return '';
  }

  function writeCookie(name, value, days) {
    var maxAge = Math.max(1, Math.floor(Number(days) || COOKIE_DAYS) * 24 * 60 * 60);
    var secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie =
      name +
      '=' +
      encodeURIComponent(value) +
      '; Path=/; Max-Age=' +
      maxAge +
      '; SameSite=Lax' +
      secure;
  }

  function codeFromUrl() {
    try {
      var params = new URLSearchParams(window.location.search || '');
      return normalizeCode(params.get('ref') || params.get('code') || params.get('affiliate') || '');
    } catch (e) {
      return '';
    }
  }

  function shouldRecordClick(code) {
    if (!code || typeof sessionStorage === 'undefined') return true;
    try {
      var key = 'tnu_aff_click_' + code;
      var prev = Number(sessionStorage.getItem(key) || 0);
      var now = Date.now();
      if (prev && now - prev < CLICK_DEDUP_MS) return false;
      sessionStorage.setItem(key, String(now));
      return true;
    } catch (e) {
      return true;
    }
  }

  function recordClick(code) {
    if (!code || !shouldRecordClick(code)) return;
    var payload = JSON.stringify({
      code: code,
      path: String(location.pathname || '').slice(0, 240),
      landingUrl: String(location.href || '').slice(0, 500),
    });
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([payload], { type: 'application/json' });
        if (navigator.sendBeacon('/api/affiliate-click', blob)) return;
      }
    } catch (e) {}
    try {
      fetch('/api/affiliate-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
        credentials: 'same-origin',
      }).catch(function () {});
    } catch (e2) {}
  }

  function captureFromUrl() {
    var code = codeFromUrl();
    if (!code) return getCode();
    writeCookie(COOKIE_NAME, code, COOKIE_DAYS);
    recordClick(code);
    return code;
  }

  function getCode() {
    return normalizeCode(readCookie(COOKIE_NAME) || codeFromUrl());
  }

  function withCode(payload) {
    var out = payload && typeof payload === 'object' ? payload : {};
    var code = getCode();
    if (code) out.affiliateCode = code;
    return out;
  }

  global.HubAffiliate = {
    COOKIE_NAME: COOKIE_NAME,
    COOKIE_DAYS: COOKIE_DAYS,
    normalizeCode: normalizeCode,
    captureFromUrl: captureFromUrl,
    getCode: getCode,
    withCode: withCode,
  };

  captureFromUrl();
})(typeof window !== 'undefined' ? window : this);
