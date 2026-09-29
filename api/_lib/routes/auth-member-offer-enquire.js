const { setCors, json, sessionFromRequest } = require('../auth');
const { enforceRateLimit } = require('../rate-limit');
const { submitMemberOfferEnquire } = require('../member-offer-enquire');
const { publicErrorPayload } = require('../public-error');

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body && typeof body === 'object' ? body : {};
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });

  const session = sessionFromRequest(req);
  if (!session) return json(res, 401, { ok: false, error: 'not_authenticated' });

  const limited = enforceRateLimit(req, res, 'member_offer_enquire', {
    max: 5,
    windowMs: 300000,
  });
  if (!limited.allowed) {
    return json(res, 429, {
      ok: false,
      error: 'rate_limited',
      message: 'Too many notes. Please wait a few minutes and try again.',
      retryAfterSec: limited.retryAfterSec,
    });
  }

  try {
    const result = await submitMemberOfferEnquire(parseBody(req), session);
    if (!result.ok) {
      return json(res, 400, {
        ok: false,
        error: result.error,
        message: result.message,
      });
    }
    return json(res, 200, result);
  } catch (e) {
    console.error('[member-offer-enquire]', e && e.message ? e.message : e);
    const payload = publicErrorPayload(e, {
      code: 'member_offer_enquire_failed',
      fallback: 'Could not send that just now. Email partnerships@thenetworkeruk.com instead.',
    });
    return json(res, payload.status >= 500 ? payload.status : 500, {
      ok: false,
      error: payload.error,
      message: payload.message,
    });
  }
};
