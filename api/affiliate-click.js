/**
 * Public — record a partner referral link click (?ref=CODE landing).
 */
const { json, setCors } = require('./_lib/auth');
const { wrapHandler } = require('./_lib/sentry');
const { enforceRateLimit } = require('./_lib/rate-limit');
const { useSupabase } = require('./_lib/supabase');
const { recordAffiliateClick } = require('./_lib/affiliate-programme');

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });

  const limited = enforceRateLimit(req, res, 'affiliate_click', {
    max: 60,
    windowMs: 300_000,
  });
  if (!limited.allowed) {
    return json(res, 429, {
      ok: false,
      error: 'rate_limited',
      retryAfterSec: limited.retryAfterSec,
    });
  }

  if (!useSupabase()) {
    return json(res, 200, { ok: true, configured: false, skipped: true });
  }

  try {
    const body = parseBody(req);
    const result = await recordAffiliateClick({
      code: body.code || body.ref,
      path: body.path,
      landingUrl: body.landingUrl || body.url || body.landing_url,
    });
    if (!result.ok) {
      return json(res, 200, { ok: true, recorded: false, reason: result.reason || 'skipped' });
    }
    return json(res, 200, { ok: true, recorded: true });
  } catch (e) {
    console.error('[affiliate-click]', e.message || e);
    return json(res, 200, { ok: true, recorded: false, reason: 'error' });
  }
});
