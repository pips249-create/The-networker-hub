/**
 * Public API — aggregate international waitlist / intake counts (no PII).
 */
const { json, setCors } = require('./_lib/auth');
const { wrapHandler } = require('./_lib/sentry');
const { enforceRateLimit } = require('./_lib/rate-limit');
const { getInternationalInterestStats } = require('./_lib/international-interest-stats');

module.exports = wrapHandler(async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const limited = enforceRateLimit(req, res, 'international_interest_stats', {
    max: 60,
    windowMs: 60_000,
  });
  if (!limited.allowed) {
    return json(res, 429, {
      ok: false,
      error: 'rate_limited',
      message: 'Too many requests. Please wait a moment.',
      retryAfterSec: limited.retryAfterSec,
    });
  }

  try {
    const data = await getInternationalInterestStats();
    return json(res, 200, data);
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: 'stats_failed',
      message: e.message || 'Could not load interest stats.',
    });
  }
});
