/**
 * Public email-link endpoint: organiser confirms or denies an attendance claim via token.
 */
const { setCors, json } = require('../auth');
const { isSupabaseConfigured } = require('../supabase');
const { respondToAttendanceClaim } = require('../attendance-claims');
const { enforceRateLimitAsync } = require('../rate-limit');

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

function readDecision(req, body) {
  let decision = '';
  try {
    const url = new URL(req.url, 'https://internal.local');
    decision = url.searchParams.get('decision') || url.searchParams.get('action') || '';
  } catch {
    decision = '';
  }
  if (!decision && body) {
    decision = body.decision || body.action || '';
  }
  return String(decision || '')
    .trim()
    .toLowerCase();
}

function readToken(req, body) {
  let token = '';
  try {
    const url = new URL(req.url, 'https://internal.local');
    token = url.searchParams.get('token') || '';
  } catch {
    token = '';
  }
  if (!token && body) token = body.token || '';
  return String(token || '').trim();
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

  const limited = await enforceRateLimitAsync(req, res, 'attendance_claim_decision', {
    max: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.allowed) {
    return json(res, 429, { ok: false, error: 'rate_limited', message: 'Too many attempts. Try again later.' });
  }

  const body = req.method === 'POST' ? parseBody(req) : {};
  const token = readToken(req, body);
  const decision = readDecision(req, body);

  if (!token) {
    return json(res, 400, { ok: false, error: 'missing_token', message: 'Missing confirmation token.' });
  }
  if (!decision) {
    return json(res, 400, {
      ok: false,
      error: 'invalid_decision',
      message: 'Choose yes or no.',
    });
  }

  try {
    const result = await respondToAttendanceClaim({ token, decision });
    const confirmed = result.claim?.status === 'confirmed';
    return json(res, 200, {
      ok: true,
      alreadyResponded: Boolean(result.alreadyResponded),
      decision: confirmed ? 'yes' : 'no',
      claim: result.claim,
      message: result.alreadyResponded
        ? confirmed
          ? 'You already confirmed this attendance claim.'
          : 'You already declined this attendance claim.'
        : confirmed
          ? 'Thanks — they can now leave an organiser-confirmed review.'
          : 'Got it — this claim was declined.',
    });
  } catch (e) {
    const code = e.code || e.message || 'claim_failed';
    const map = {
      invalid_or_expired_token: 'This confirmation link is invalid or has expired.',
      claim_not_found: 'That attendance claim could not be found.',
      claim_not_pending: 'This claim is no longer waiting for a response.',
      claim_expired: 'This claim expired before a response.',
      invalid_decision: 'Choose yes or no.',
    };
    if (map[code]) {
      return json(res, 400, { ok: false, error: code, message: map[code] });
    }
    return json(res, 500, { ok: false, error: 'claim_failed', message: e.message || String(e) });
  }
};
