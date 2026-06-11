const {
  sessionFromRequest,
  setSessionCookie,
  setCors,
  json,
  isAdminRole,
  normalizeRole,
} = require('../auth');
const sbAuth = require('../supabase-auth');
const {
  isAdminMfaEnforcementEnabled,
  generateSecret,
  otpauthUri,
  enrollAdminMfa,
  verifyAdminMfa,
  isAdminMfaEnrolled,
  adminMfaStatusForSession,
} = require('../admin-mfa');

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

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = sessionFromRequest(req);
  if (!session || !isAdminRole(session.role)) {
    return json(res, 401, { ok: false, error: 'admin_only', message: 'Admin sign-in required.' });
  }
  if (session.impersonator) {
    return json(res, 403, {
      ok: false,
      error: 'impersonating',
      message: 'Stop impersonating before using Command Centre MFA.',
    });
  }

  if (req.method === 'GET') {
    const enrolled = await isAdminMfaEnrolled(session.sub);
    const status = adminMfaStatusForSession(session, enrolled);
    return json(res, 200, {
      ok: true,
      enabled: isAdminMfaEnforcementEnabled(),
      email: session.email,
      ...status,
    });
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const body = parseBody(req);
  const action = String(body.action || '').trim().toLowerCase();

  try {
    if (action === 'enroll-start') {
      const enrolled = await isAdminMfaEnrolled(session.sub);
      if (enrolled) {
        return json(res, 400, {
          ok: false,
          error: 'already_enrolled',
          message: 'Authenticator is already set up. Enter a code to verify access.',
        });
      }
      const secret = generateSecret();
      return json(res, 200, {
        ok: true,
        secret,
        otpauthUrl: otpauthUri(session.email, secret),
        message: 'Add this key to your authenticator app, then confirm with a 6-digit code.',
      });
    }

    if (action === 'enroll-complete') {
      const secret = String(body.secret || '').trim().toUpperCase();
      const code = String(body.code || '').trim();
      if (!secret || !code) {
        return json(res, 400, { ok: false, error: 'missing_fields', message: 'Secret and code are required.' });
      }
      await enrollAdminMfa(session.sub, secret, code);
      const user = await sbAuth.findUserByEmail(session.email);
      const fresh = {
        sub: session.sub,
        email: session.email,
        role: normalizeRole(user?.role || session.role),
        name: user?.name || session.name,
        adminMfaEnrolled: true,
        adminMfaAt: Math.floor(Date.now() / 1000),
      };
      setSessionCookie(res, fresh);
      return json(res, 200, {
        ok: true,
        message: 'Authenticator enrolled. Command Centre access is unlocked for this session.',
        redirect: '/admin/index.html',
      });
    }

    if (action === 'verify') {
      const code = String(body.code || '').trim();
      if (!code) {
        return json(res, 400, { ok: false, error: 'missing_code', message: 'Enter the 6-digit code.' });
      }
      await verifyAdminMfa(session.sub, code);
      const user = await sbAuth.findUserByEmail(session.email);
      const fresh = {
        sub: session.sub,
        email: session.email,
        role: normalizeRole(user?.role || session.role),
        name: user?.name || session.name,
        adminMfaEnrolled: true,
        adminMfaAt: Math.floor(Date.now() / 1000),
      };
      setSessionCookie(res, fresh);
      return json(res, 200, {
        ok: true,
        message: 'Verified.',
        redirect: '/admin/index.html',
      });
    }

    return json(res, 400, { ok: false, error: 'invalid_action' });
  } catch (e) {
    const status = e.status || 500;
    const messages = {
      invalid_mfa_code: 'That code was not accepted. Check the time on your device and try again.',
      mfa_not_enrolled: 'Set up an authenticator app before verifying.',
    };
    return json(res, status, {
      ok: false,
      error: e.message || 'mfa_failed',
      message: messages[e.message] || e.message || 'MFA request failed.',
    });
  }
};
