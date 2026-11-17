/**
 * POST /api/event-attend-enquiry — "I'd like to attend" for email Link Out events.
 */
const { json, setCors } = require('./_lib/auth');
const { wrapHandler } = require('./_lib/sentry');
const { enforceRateLimitAsync } = require('./_lib/rate-limit');
const { submitEventAttendEnquiry } = require('./_lib/event-attend-enquiry');
const { publicErrorPayload } = require('./_lib/public-error');
const { isSupabaseConfigured } = require('./_lib/supabase');

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

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'not_configured' });
  }

  const limited = await enforceRateLimitAsync(req, res, 'event_attend_enquiry', {
    max: 8,
    windowMs: 300_000,
  });
  if (!limited.allowed) {
    return json(res, 429, {
      ok: false,
      error: 'rate_limited',
      message: 'Too many requests. Please wait a few minutes and try again.',
      retryAfterSec: limited.retryAfterSec,
    });
  }

  try {
    const result = await submitEventAttendEnquiry(parseBody(req));
    if (!result.ok) {
      return json(res, 400, result);
    }
    return json(res, 200, result);
  } catch (e) {
    const code = e && e.code ? String(e.code) : '';
    if (
      code === 'event_not_found' ||
      code === 'event_not_public' ||
      code === 'attend_enquiry_not_available' ||
      code === 'organiser_email_missing' ||
      code === 'missing_event_id'
    ) {
      return json(res, code === 'event_not_found' ? 404 : 400, {
        ok: false,
        error: code,
        message: e.message || code,
      });
    }
    console.error('[event-attend-enquiry]', e && e.message ? e.message : e);
    return json(res, 500, publicErrorPayload(e, { error: 'attend_enquiry_failed' }));
  }
});
