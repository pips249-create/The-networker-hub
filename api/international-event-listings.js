/**
 * Public API — submit / browse worldwide link-out events on International.
 */
const { json, setCors } = require('./_lib/auth');
const { wrapHandler } = require('./_lib/sentry');
const { enforceRateLimit } = require('./_lib/rate-limit');
const { useSupabase } = require('./_lib/supabase');
const {
  submitInternationalEventListing,
  listPublicInternationalEventListings,
} = require('./_lib/international-event-listings');

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body || {};
}

module.exports = wrapHandler(async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      const countryCode =
        (req.query && (req.query.countryCode || req.query.country_code || req.query.country)) || '';
      const limit = req.query && req.query.limit;
      const result = await listPublicInternationalEventListings({
        countryCode: countryCode,
        limit: limit,
      });
      return json(res, 200, result);
    } catch (e) {
      return json(res, 500, {
        ok: false,
        error: 'list_failed',
        message: e.message || 'Could not load events.',
      });
    }
  }

  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const limited = enforceRateLimit(req, res, 'international_event_listings', {
    max: 6,
    windowMs: 300_000,
  });
  if (!limited.allowed) {
    return json(res, 429, {
      ok: false,
      error: 'rate_limited',
      message: 'Too many submissions. Please wait a few minutes and try again.',
      retryAfterSec: limited.retryAfterSec,
    });
  }

  if (!useSupabase()) {
    return json(res, 503, {
      ok: false,
      error: 'not_configured',
      message: 'Online submissions are not available yet — email hi@thenetworkeruk.com.',
    });
  }

  try {
    const result = await submitInternationalEventListing(parseBody(req));
    if (!result.ok) {
      return json(res, 400, {
        ok: false,
        error: result.error,
        message: result.message,
      });
    }
    return json(res, 200, result);
  } catch (e) {
    const code = e.code || 'submit_failed';
    const status = code === 'not_configured' ? 503 : 500;
    return json(res, status, {
      ok: false,
      error: code,
      message: e.message || 'Could not save your event.',
    });
  }
});
