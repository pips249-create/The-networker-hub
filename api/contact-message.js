/**
 * POST /api/contact-message — Contact page team form.
 */
const { json, setCors } = require('./_lib/auth');
const { wrapHandler } = require('./_lib/sentry');
const { enforceRateLimit, clientIp } = require('./_lib/rate-limit');
const { verifyTurnstileToken } = require('./_lib/turnstile');
const { submitContactTeamMessage } = require('./_lib/contact-team-message');
const { publicErrorPayload } = require('./_lib/public-error');

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

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const limited = enforceRateLimit(req, res, 'contact_team_message', {
    max: 8,
    windowMs: 300_000,
  });
  if (!limited.allowed) {
    return json(res, 429, {
      ok: false,
      error: 'rate_limited',
      message: 'Too many messages. Please wait a few minutes and try again.',
      retryAfterSec: limited.retryAfterSec,
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
    const result = await submitContactTeamMessage(body);
    if (!result.ok) {
      return json(res, 400, {
        ok: false,
        error: result.error,
        message: result.message,
      });
    }
    return json(res, 200, result);
  } catch (e) {
    console.error('[contact-message]', e && e.message ? e.message : e);
    const payload = publicErrorPayload(e, {
      code: e.code || 'contact_failed',
      fallback: 'Could not send your message. Please email hi@thenetworkeruk.com instead.',
    });
    return json(res, payload.status >= 500 ? payload.status : 500, {
      ok: false,
      error: payload.error,
      message: payload.message,
    });
  }
});