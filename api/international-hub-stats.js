/**
 * Public API — catalogue counts for live international hub countries.
 */
const { json, setCors } = require('./_lib/auth');
const { enforceRateLimit } = require('./_lib/rate-limit');
const { useSupabase } = require('./_lib/supabase');
const { getInternationalHubStats } = require('./_lib/international-hub-stats');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const limited = enforceRateLimit(req, res, 'international_hub_stats', {
    max: 30,
    windowMs: 300_000,
  });
  if (!limited.allowed) {
    return json(res, 429, {
      ok: false,
      error: 'rate_limited',
      retryAfterSec: limited.retryAfterSec,
    });
  }

  const countryCode = String(req.query?.country || req.query?.countryCode || 'GB').trim();

  if (!useSupabase()) {
    return json(res, 200, {
      ok: true,
      countryCode: countryCode.toUpperCase(),
      configured: false,
      events: null,
      organisers: null,
      opportunities: null,
    });
  }

  try {
    const result = await getInternationalHubStats(countryCode);
    if (!result.ok) {
      return json(res, 400, result);
    }
    return json(res, 200, result);
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: 'stats_failed',
      message: e.message || 'Could not load hub stats.',
    });
  }
};
