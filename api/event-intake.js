/**
 * Public event intake API — organisers send details for staff to list.
 */
const { json, setCors } = require('./_lib/auth');
const { wrapHandler } = require('./_lib/sentry');
const { enforceRateLimit, clientIp } = require('./_lib/rate-limit');
const { useSupabase } = require('./_lib/supabase');
const { submitEventIntake } = require('./_lib/event-intake');
const { verifyTurnstileToken } = require('./_lib/turnstile');

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

  const limited = enforceRateLimit(req, res, 'event_intake', {
    max: 8,
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

  const body = parseBody(req);
  const captcha = await verifyTurnstileToken(
    body.turnstileToken || body['cf-turnstile-response'],
    clientIp(req)
  );
  if (!captcha.ok) {
    return json(res, 400, {
      ok: false,
      error: captcha.error || 'captcha_failed',
      message: 'Please complete the security check and try again.',
    });
  }

  try {
    const result = await submitEventIntake(body);
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
      message: e.message || 'Could not send your event details.',
    });
  }
});