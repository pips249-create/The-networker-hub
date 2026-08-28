/**
 * Server-side Sentry for Vercel serverless API routes.
 * Set SENTRY_DSN in Vercel (same DSN as the browser project is fine).
 */
let Sentry = null;
let initialized = false;

function loadSentry() {
  if (Sentry) return Sentry;
  try {
    Sentry = require('@sentry/node');
  } catch (e) {
    Sentry = null;
  }
  return Sentry;
}

function initSentry() {
  if (initialized) return loadSentry();
  const sdk = loadSentry();
  const dsn = String(process.env.SENTRY_DSN || '').trim();
  if (!sdk || !dsn) return sdk;

  sdk.init({
    dsn,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
  initialized = true;
  return sdk;
}

function captureServerException(err, context) {
  const sdk = initSentry();
  if (!sdk || !err) return;
  sdk.withScope(function (scope) {
    if (context && typeof context === 'object') {
      if (context.route) scope.setTag('route', String(context.route));
      if (context.logLabel) scope.setTag('logLabel', String(context.logLabel));
      if (context.extra) scope.setExtras(context.extra);
    }
    sdk.captureException(err);
  });
}

async function flushSentry(timeoutMs) {
  const sdk = loadSentry();
  if (!sdk || typeof sdk.flush !== 'function') return;
  try {
    await sdk.flush(timeoutMs || 2000);
  } catch (e) {
    /* ignore */
  }
}

function wrapHandler(handler) {
  return async function sentryWrappedHandler(req, res) {
    initSentry();
    try {
      return await handler(req, res);
    } catch (err) {
      captureServerException(err, { route: req && req.url ? String(req.url).split('?')[0] : '' });
      await flushSentry(2000);
      throw err;
    }
  };
}

module.exports = {
  initSentry,
  captureServerException,
  flushSentry,
  wrapHandler,
};
