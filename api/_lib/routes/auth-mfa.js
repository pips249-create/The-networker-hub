const {
  sessionFromRequest,
  requireAdmin,
  setSessionCookie,
  json,
  setCors,
} = require('../auth');
const adminMfa = require('../admin-mfa');
const { enforceRateLimit } = require('../rate-limit');

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

/**
 * Admin MFA — enroll, verify status, disable.
 * POST body.action: begin | confirm | disable
 */
module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error, message: gate.message });

  const mfaEnrolled = await adminMfa.isMfaEnrolled(session.sub);
  if (mfaEnrolled && !session.mfaVerified && String(parseBody(req).action || '').toLowerCase() !== 'disable') {
    return json(res, 403, {
      error: 'mfa_required',
      message: 'Sign in again with your authenticator code before changing MFA settings.',
    });
  }

  if (req.method === 'GET') {
    const enrolled = await adminMfa.isMfaEnrolled(session.sub);
    return json(res, 200, {
      ok: true,
      enrolled,
      mfaVerified: Boolean(session.mfaVerified),
    });
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const body = parseBody(req);
  const action = String(body.action || '').trim().toLowerCase();

  if (action === 'begin') {
    const limited = enforceRateLimit(req, res, 'admin_mfa_begin', { max: 6, windowMs: 300_000 });
    if (!limited.allowed) {
      return json(res, 429, {
        error: 'rate_limited',
        retryAfterSec: limited.retryAfterSec,
      });
    }

    const enrolled = await adminMfa.isMfaEnrolled(session.sub);
    if (enrolled) {
      return json(res, 409, { error: 'already_enrolled', message: 'MFA is already enabled.' });
    }

    const setup = adminMfa.beginEnrollment(session.email);
    return json(res, 200, {
      ok: true,
      otpauthUrl: setup.otpauthUrl,
      secret: setup.secret,
      message: 'Add this account to your authenticator app, then confirm with a code.',
    });
  }

  if (action === 'confirm') {
    const limited = enforceRateLimit(req, res, 'admin_mfa_confirm', { max: 8, windowMs: 300_000 });
    if (!limited.allowed) {
      return json(res, 429, {
        error: 'rate_limited',
        retryAfterSec: limited.retryAfterSec,
      });
    }

    const secret = String(body.secret || '').trim();
    const code = String(body.code || '').trim();
    if (!secret || !code) {
      return json(res, 400, { error: 'missing_fields', message: 'Provide secret and code.' });
    }
    if (!adminMfa.verifyPendingEnrollment(secret, code)) {
      return json(res, 401, { error: 'invalid_code', message: 'Authenticator code is incorrect.' });
    }

    await adminMfa.confirmEnrollment(session.sub, secret);
    if (
      !setSessionCookie(
        res,
        {
          sub: session.sub,
          email: session.email,
          role: session.role,
          name: session.name,
          mfaEnrolled: true,
          mfaVerified: true,
        },
        { rememberMe: true }
      )
    ) {
      return json(res, 503, { error: 'session_failed' });
    }

    return json(res, 200, { ok: true, enrolled: true, message: 'Two-factor authentication is now enabled.' });
  }

  if (action === 'disable') {
    const limited = enforceRateLimit(req, res, 'admin_mfa_disable', { max: 6, windowMs: 300_000 });
    if (!limited.allowed) {
      return json(res, 429, {
        error: 'rate_limited',
        retryAfterSec: limited.retryAfterSec,
      });
    }

    const code = String(body.code || '').trim();
    if (!code) {
      return json(res, 400, { error: 'missing_code', message: 'Provide your current authenticator code.' });
    }

    const disabled = await adminMfa.disableEnrollment(session.sub, code);
    if (!disabled) {
      return json(res, 401, { error: 'invalid_code', message: 'Authenticator code is incorrect.' });
    }

    if (
      !setSessionCookie(
        res,
        {
          sub: session.sub,
          email: session.email,
          role: session.role,
          name: session.name,
          mfaEnrolled: false,
          mfaVerified: true,
        },
        { rememberMe: true }
      )
    ) {
      return json(res, 503, { error: 'session_failed' });
    }

    return json(res, 200, { ok: true, enrolled: false, message: 'Two-factor authentication disabled.' });
  }

  return json(res, 400, { error: 'invalid_action', message: 'Use action: begin, confirm, or disable.' });
};
