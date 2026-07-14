const {
  setSessionCookie,
  json,
  sessionFromRequest,
  setCors,
  normalizeRole,
  isAdminRole,
  hubViewFromRequest,
} = require('../auth');
const { useSupabase } = require('../supabase');
const sbAuth = require('../supabase-auth');
const { enforceRateLimit } = require('../rate-limit');
const adminMfa = require('../admin-mfa');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const session = sessionFromRequest(req);
    return json(res, 200, { ok: !!session, user: session || null });
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  if (!process.env.SESSION_SECRET) {
    return json(res, 503, {
      error: 'not_configured',
      message: 'Set SESSION_SECRET in Vercel (random 32+ character string).',
    });
  }

  if (!useSupabase()) {
    return json(res, 503, {
      error: 'not_configured',
      message: 'Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_ANON_KEY. See SUPABASE-FRESH-START.md.',
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  const email = String(body.email || '')
    .trim()
    .toLowerCase();
  const password = String(body.password || '');
  const rememberMe = Boolean(body.rememberMe);
  const totpCode = String(body.totpCode || body.code || '').trim();

  if (!email || !password) {
    return json(res, 400, { error: 'missing_credentials' });
  }

  const limited = enforceRateLimit(req, res, 'auth_login', { max: 12, windowMs: 300_000 });
  if (!limited.allowed) {
    return json(res, 429, {
      error: 'rate_limited',
      message: 'Too many sign-in attempts. Please wait a few minutes and try again.',
      retryAfterSec: limited.retryAfterSec,
    });
  }

  try {
    const login = await sbAuth.verifyLogin(email, password);
    if (!login.ok) {
      return json(res, 401, {
        error: 'invalid_credentials',
        message: 'Email or password is incorrect.',
      });
    }

    const user = await sbAuth.findUserByEmail(email);
    if (!user) {
      return json(res, 401, { error: 'no_account', message: 'No account for this email.' });
    }

    const role = normalizeRole(user.role);
    const mfaEnrolled = isAdminRole(role) ? await adminMfa.isMfaEnrolled(user.id) : false;

    if (mfaEnrolled) {
      if (!totpCode) {
        return json(res, 401, {
          error: 'mfa_required',
          mfaRequired: true,
          message: 'Enter the 6-digit code from your authenticator app.',
        });
      }
      const mfaOk = await adminMfa.verifyUserCode(user.id, totpCode);
      if (!mfaOk) {
        return json(res, 401, {
          error: 'invalid_mfa_code',
          mfaRequired: true,
          message: 'Authenticator code is incorrect.',
        });
      }
    }

    const sessionUser = {
      sub: user.id,
      email: user.email,
      role,
      name: user.name,
      mfaEnrolled,
      mfaVerified: true,
    };

    if (!setSessionCookie(res, sessionUser, { rememberMe })) {
      return json(res, 503, { error: 'session_failed' });
    }

    await sbAuth.backfillAttendeeUserId(sessionUser.sub, sessionUser.email);

    try {
      const { bootstrapOrganiserFromPendingClaims } = require('../supabase-organiser-claims');
      await bootstrapOrganiserFromPendingClaims(sessionUser);
    } catch {
      /* login succeeds even if bootstrap fails */
    }

    let redirect = body.next || '/events/';
    if (isAdminRole(role) && !body.next) {
      redirect = '/admin/';
    } else if (hubViewFromRequest(req) === 'organiser') {
      redirect = body.next || '/organiser/';
    }

    return json(res, 200, {
      ok: true,
      user: sessionUser,
      redirect,
    });
  } catch (e) {
    return json(res, 500, {
      error: 'server_error',
      message: e.message,
    });
  }
};
