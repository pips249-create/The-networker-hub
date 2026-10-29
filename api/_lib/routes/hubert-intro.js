/**
 * Public email-link endpoint: Accept / Decline a Hubert intro via signed token.
 * Also supports GET preview of the request context (no contact details).
 */
const { setCors, json } = require('../auth');
const { isSupabaseConfigured } = require('../supabase');
const { previewIntroFromToken, respondToIntro } = require('../hubert-intro-requests');
const { enforceRateLimit, enforceRateLimitAsync } = require('../rate-limit');

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

function readParam(req, body, key) {
  let value = '';
  try {
    const url = new URL(req.url, 'https://internal.local');
    value = url.searchParams.get(key) || '';
  } catch {
    value = '';
  }
  if (!value && body) value = body[key] || '';
  return String(value || '').trim();
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  const body = req.method === 'POST' ? parseBody(req) : {};
  const token = readParam(req, body, 'token');
  if (!token) {
    return json(res, 400, { ok: false, error: 'missing_token', message: 'Missing introduction link.' });
  }

  if (req.method === 'GET') {
    // In-memory only — avoid a durable rate-limit RPC on every email open.
    const limited = enforceRateLimit(req, res, 'hubert_intro_preview', {
      max: 120,
      windowMs: 60 * 60 * 1000,
    });
    if (!limited.allowed) {
      return json(res, 429, { ok: false, error: 'rate_limited', message: 'Too many attempts. Try again later.' });
    }
    try {
      const preview = await previewIntroFromToken(token);
      return json(res, 200, { ok: true, intro: preview });
    } catch (e) {
      const code = e && e.code ? e.code : 'preview_failed';
      const status = code === 'invalid_or_expired_token' || code === 'intro_not_found' ? 400 : 500;
      return json(res, status, {
        ok: false,
        error: code,
        message: e && e.message ? e.message : 'Could not load this introduction.',
      });
    }
  }

  const limited = await enforceRateLimitAsync(req, res, 'hubert_intro_decision', {
    max: 40,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.allowed) {
    return json(res, 429, { ok: false, error: 'rate_limited', message: 'Too many attempts. Try again later.' });
  }

  const decision = readParam(req, body, 'decision') || readParam(req, body, 'action');
  if (!decision) {
    return json(res, 400, {
      ok: false,
      error: 'invalid_decision',
      message: 'Choose Accept or Decline.',
    });
  }

  try {
    const result = await respondToIntro({ token, decision, reason: body.reason });
    const accepted = result.intro?.status === 'accepted';
    return json(res, 200, {
      ok: true,
      alreadyResponded: Boolean(result.alreadyResponded),
      decision: accepted ? 'accept' : 'decline',
      intro: result.intro,
      message: result.alreadyResponded
        ? accepted
          ? 'You already accepted this introduction.'
          : 'You already declined this introduction.'
        : accepted
          ? 'You’re introduced — open the Hub thread to continue (no contact details shared).'
          : 'Declined. Hubert won’t open an introduction.',
    });
  } catch (e) {
    const code = e && e.code ? e.code : 'respond_failed';
    const status =
      code === 'invalid_or_expired_token' ||
      code === 'intro_not_found' ||
      code === 'intro_not_pending' ||
      code === 'invalid_decision'
        ? 400
        : 500;
    return json(res, status, {
      ok: false,
      error: code,
      message: e && e.message ? e.message : 'Could not save your answer.',
    });
  }
};
