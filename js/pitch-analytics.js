/**
 * First-party opens for confidential /p-tnh-* sales decks.
 * Works without cookie consent (no third-party scripts; path + action only).
 */
(function () {
  var SESSION_KEY_PREFIX = 'tnh_pitch_view_v1:';

  function normalizePath(raw) {
    var p = String(raw || '')
      .split('?')[0]
      .split('#')[0]
      .toLowerCase();
    if (p.indexOf('.html') === p.length - 5) p = p.slice(0, -5);
    if (p.length > 1 && p.charAt(p.length - 1) === '/') p = p.slice(0, -1);
    return p || '/';
  }

  function isPitchPath(path) {
    return /^\/p-tnh-[a-z0-9-]+$/.test(path);
  }

  function isLocalHost() {
    var host = String(window.location.hostname || '').toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
  }

  function post(payload) {
    try {
      fetch('/api/pitch-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: 'omit',
      }).catch(function () {
        /* analytics optional */
      });
    } catch (e) {
      /* analytics optional */
    }
  }

  function record(action, extra) {
    if (isLocalHost()) return;
    var path = normalizePath(window.location.pathname);
    if (!isPitchPath(path)) return;
    var act = String(action || 'view')
      .trim()
      .toLowerCase();
    if (act !== 'view' && act !== 'pdf_download') return;

    var payload = {
      action: act,
      path: path,
      label: String((extra && extra.label) || document.title || '').slice(0, 120),
      referrer: String(document.referrer || '').slice(0, 200),
    };
    post(payload);
  }

  function recordViewOnce() {
    if (isLocalHost()) return;
    var path = normalizePath(window.location.pathname);
    if (!isPitchPath(path)) return;
    var key = SESSION_KEY_PREFIX + path;
    try {
      if (window.sessionStorage && sessionStorage.getItem(key)) return;
      if (window.sessionStorage) sessionStorage.setItem(key, '1');
    } catch (e) {
      /* private mode — still record once this load */
    }
    record('view');
  }

  window.HubPitchAnalytics = {
    record: record,
    recordViewOnce: recordViewOnce,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', recordViewOnce);
  } else {
    recordViewOnce();
  }
})();
