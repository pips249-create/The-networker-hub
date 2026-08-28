/**
 * Production error monitoring (Sentry). Not gated behind analytics consent —
 * operational fault reporting, not marketing analytics. PII scrubbed in beforeSend.
 */
(function () {
  var DSN =
    'https://ed87933e8496b3ed118c576494ab2376@o4511987677659136.ingest.de.sentry.io/4511987801260117';
  var BUNDLE_SRC = 'https://browser.sentry-cdn.com/10.71.0/bundle.min.js';

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

  function initSentry() {
    if (!window.Sentry || typeof window.Sentry.init !== 'function') return;
    if (window.Sentry.getClient && window.Sentry.getClient()) return;
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
      beforeSend: scrubEvent,
    });
  }

  if (isLocalHost()) return;
  if (document.querySelector('script[data-hub-sentry-bundle="1"]')) return;

  if (window.Sentry && typeof window.Sentry.init === 'function') {
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
