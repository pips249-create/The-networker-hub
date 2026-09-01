/**
 * Production error monitoring (Sentry). Not gated behind analytics consent —
 * operational fault reporting, not marketing analytics. PII scrubbed in beforeSend.
 */
(function () {
  var DSN =
    'https://ed87933e8496b3ed118c576494ab2376@o4511987677659136.ingest.de.sentry.io/4511987801260117';
  var BUNDLE_SRC = 'https://browser.sentry-cdn.com/10.71.0/bundle.min.js';

  if (!window.__hubFontsSafe) {
    try {
      if (document.fonts && document.fonts.ready && document.fonts.ready.catch) {
        document.fonts.ready.catch(function () {});
      }
      window.__hubFontsSafe = true;
    } catch (_eFont) {
      /* ignore */
    }
  }

  function isLocalHost() {
    var host = String(window.location.hostname || '').toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
  }

  function scrubEvent(event) {
    if (!event || typeof event !== 'object') return event;
    try {
      if (event.user) {
        delete event.user.email;
        delete event.user.username;
        delete event.user.ip_address;
      }
      if (event.request) {
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers.Cookie;
          delete event.request.headers.cookie;
          delete event.request.headers.Authorization;
          delete event.request.headers.authorization;
        }
      }
    } catch (e) {
      /* ignore scrub errors */
    }
    return event;
  }

  function breadcrumbsMentionFontFace(event) {
    var crumbs = event && event.breadcrumbs;
    if (!Array.isArray(crumbs)) return false;
    for (var i = 0; i < crumbs.length; i++) {
      var msg = String((crumbs[i] && crumbs[i].message) || '');
      if (/FontFace/i.test(msg)) return true;
    }
    return false;
  }

  function isFontNetworkError(event, hint) {
    var ex = hint && hint.originalException;
    if (!ex) return false;
    var name = String(ex.name || '');
    var msg = String(ex.message || ex.toString ? ex.toString() : '');
    if (name !== 'NetworkError' && !/network error occurred/i.test(msg)) return false;
    return breadcrumbsMentionFontFace(event);
  }

  function beforeSend(event, hint) {
    if (isFontNetworkError(event, hint)) return null;
    return scrubEvent(event);
  }

  function removeDeprecatedLoader() {
    document.querySelectorAll('script[data-hub-sentry-loader="1"]').forEach(function (el) {
      el.parentNode.removeChild(el);
    });
  }

  function isRealSentrySdk() {
    return !!(window.Sentry && typeof window.Sentry.init === 'function' && typeof window.Sentry.getClient === 'function');
  }

  function clearNoopSentryStub() {
    if (isRealSentrySdk()) return;
    if (!window.Sentry) return;
    try {
      delete window.Sentry;
    } catch (_eDel) {
      window.Sentry = undefined;
    }
  }

  function captureAdminReport(level, code, message, extra, err) {
    if (isLocalHost()) return;
    if (!isRealSentrySdk()) return;
    try {
      if (!window.Sentry.getClient()) initSentry();
      if (!window.Sentry.getClient()) return;
      window.Sentry.withScope(function (scope) {
        scope.setTag('hub_report', 'admin');
        scope.setTag('admin_action', String(code || 'unknown'));
        if (extra && typeof extra === 'object') {
          Object.keys(extra).forEach(function (key) {
            scope.setExtra(key, extra[key]);
          });
        }
        if (err) {
          window.Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
            level: level || 'error',
          });
        } else {
          window.Sentry.captureMessage(String(message || code || 'Admin action issue'), {
            level: level || 'warning',
          });
        }
      });
    } catch (_eCap) {
      /* ignore */
    }
  }

  window.HubSentry = {
    reportAdminIssue: function (code, message, extra) {
      captureAdminReport('warning', code, message, extra, null);
    },
    reportAdminError: function (code, err, extra) {
      var msg =
        err && err.message ? String(err.message) : String(err || 'Admin action failed');
      captureAdminReport('error', code, msg, extra, err);
    },
  };

  function initSentry() {
    if (!isRealSentrySdk()) return;
    if (window.Sentry.getClient()) return;
    var env = 'production';
    try {
      if (window.location.hostname.indexOf('vercel.app') !== -1) env = 'preview';
    } catch (e2) {
      /* ignore */
    }
    window.Sentry.init({
      dsn: DSN,
      environment: env,
      sendDefaultPii: false,
      ignoreErrors: ['NetworkError: A network error occurred.'],
      beforeSend: beforeSend,
    });
  }

  if (isLocalHost()) return;

  removeDeprecatedLoader();
  clearNoopSentryStub();

  if (document.querySelector('script[data-hub-sentry-bundle="1"]')) {
    if (isRealSentrySdk()) initSentry();
    return;
  }

  if (isRealSentrySdk()) {
    initSentry();
    return;
  }

  var script = document.createElement('script');
  script.src = BUNDLE_SRC;
  script.crossOrigin = 'anonymous';
  script.setAttribute('data-hub-sentry-bundle', '1');
  script.onload = initSentry;
  document.head.appendChild(script);
})();
