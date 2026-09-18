/**
 * GET /api/partner-terms?code= — public terms acceptance status for a partner code.
 * POST /api/partner-terms — accept terms (code + matching email).
 */
const { json, setCors } = require('./_lib/auth');
const { wrapHandler } = require('./_lib/sentry');
const { enforceRateLimit } = require('./_lib/rate-limit');
const { publicTermsStatus, acceptPartnerTerms } = require('./_lib/partner-terms');
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    const code = req.query && req.query.code;
    try {
      const status = await publicTermsStatus(code);
      if (!status.ok) {
        return json(res, 404, { ok: false, error: status.error || 'unknown_code' });
      }
      return json(res, 200, status);
    } catch (e) {
      console.error('[partner-terms-get]', e.message || e);
      return json(res, 500, { ok: false, error: 'terms_status_failed' });
    }
  }

  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const limited = enforceRateLimit(req, res, 'partner_terms_accept', {
    max: 12,
    windowMs: 300_000,
  });
  if (!limited.allowed) {
    return json(res, 429, {
      ok: false,
      error: 'rate_limited',
      message: 'Too many attempts. Please wait a few minutes and try again.',
    });
  }

  const body = parseBody(req);
  try {
    const result = await acceptPartnerTerms({
      code: body.code || body.ref,
      email: body.email,
      agreed: body.agreedToTerms ?? body.agreed,
    });
    if (!result.ok) {
      const status =
        result.error === 'email_mismatch' || result.error === 'terms_required' ? 400 : 404;
      return json(res, status, result);
    }
    return json(res, 200, result);
  } catch (e) {
    console.error('[partner-terms-post]', e.message || e);
    const payload = publicErrorPayload(e, {
      code: 'terms_accept_failed',
      fallback: 'Could not record acceptance. Email partnerships@thenetworkeruk.com.',
    });
    return json(res, payload.status >= 500 ? payload.status : 500, {
      ok: false,
      error: payload.error,
      message: payload.message,
    });
  }
});
