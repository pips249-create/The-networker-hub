/**
 * Public API — submit a networking group / training org from a building market.
 */
const { json, setCors } = require('./_lib/auth');
const { wrapHandler } = require('./_lib/sentry');
const { enforceRateLimit } = require('./_lib/rate-limit');
const { useSupabase } = require('./_lib/supabase');
const { submitInternationalGroupIntake } = require('./_lib/international-group-intake');

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

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const limited = enforceRateLimit(req, res, 'international_group_intake', {
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
    const result = await submitInternationalGroupIntake(parseBody(req));
    if (!result.ok) {
      return json(res, 400, {
        ok: false,
        error: result.error,
        message: result.message,
      });
    }
    return json(res, 200, result);
  } catch (e) {
    const code = e.code || 'intake_failed';
    const status = code === 'not_configured' ? 503 : 500;
    return json(res, status, {
      ok: false,
      error: code,
      message: e.message || 'Could not save your details.',
    });
  }
});