const { setSessionCookie, json, setCors, hubViewFromRequest } = require('../auth');
const { useSupabase } = require('../supabase');
const sbAuth = require('../supabase-auth');
const { sendAccountWelcomeEmail } = require('../account-emails');
const { enforceRateLimit } = require('../rate-limit');
const {
  isOrganiserAuthIntent,
  isOrganiserClaimNext,
  maybeAutoEnableOrganiserAccess,
  redirectAfterOrganiserAuth,
} = require('../organiser-auth-intent');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  if (!process.env.SESSION_SECRET) {
    return json(res, 503, {
      error: 'not_configured',
      message: 'Set SESSION_SECRET in Vercel.',
    });
  }

  if (!useSupabase()) {
    return json(res, 503, {
      error: 'not_configured',
      message: 'Supabase is not configured. See SUPABASE-FRESH-START.md.',
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
  const name = String(body.name || '').trim();
  const marketingOptIn = Boolean(body.marketingOptIn ?? body.marketing_opt_in);

  if (!email || !password) {
    return json(res, 400, {
      error: 'missing_fields',
      message: 'Enter your email and a password.',
    });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(res, 400, { error: 'invalid_email', message: 'Enter a valid email address.' });
  }
  if (password.length < 8) {
    return json(res, 400, {
      error: 'weak_password',
      message: 'Password must be at least 8 characters.',
    });
  }

  const limited = enforceRateLimit(req, res, 'auth_register', { max: 8, windowMs: 300_000 });
  if (!limited.allowed) {
    return json(res, 429, {
      error: 'rate_limited',
      message: 'Too many sign-up attempts. Please wait a few minutes and try again.',
      retryAfterSec: limited.retryAfterSec,
    });
  }

  try {
    const user = await sbAuth.registerUser({ email, password, name, marketingOptIn });

    const sessionUser = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name || name || '',
    };

    if (!setSessionCookie(res, sessionUser)) {
      return json(res, 503, { error: 'session_failed' });
    }

    let redirect = body.next || '/welcome';
    if (hubViewFromRequest(req) === 'organiser' && !body.next) {
      redirect = '/welcome';
    }

    try {
      // Claim flow sends organiser_claim_confirmed right after Yes — skip generic welcome.
      const claimSignup =
        String(body.intent || '')
          .trim()
          .toLowerCase() === 'organiser-claim' || isOrganiserClaimNext(body.next);
      if (!claimSignup) {
        await sendAccountWelcomeEmail({ email, name });
      }
    } catch {
      /* Registration succeeds even if welcome email fails */
    }

    try {
      const { bootstrapOrganiserFromPendingClaims } = require('../supabase-organiser-claims');
      await bootstrapOrganiserFromPendingClaims(sessionUser);
    } catch {
      /* registration succeeds even if bootstrap fails */
    }

    let autoEnable = { enabled: false, redirect: null };
    if (isOrganiserAuthIntent({ next: body.next, intent: body.intent })) {
      try {
        autoEnable = await maybeAutoEnableOrganiserAccess(sessionUser, res);
      } catch {
        /* registration succeeds even if auto-enable fails */
      }
    }

    redirect = redirectAfterOrganiserAuth({
      next: body.next,
      intent: body.intent,
      autoResult: autoEnable,
      defaultRedirect: redirect,
    });

    return json(res, 201, {
      ok: true,
      message: 'Your account has been created.',
      user: sessionUser,
      redirect,
    });
  } catch (e) {
    const msg = e.message || 'Could not create your account.';
    const code = /already exists/i.test(msg) ? 'email_exists' : 'register_failed';
    return json(res, code === 'email_exists' ? 409 : 500, {
      error: code,
      message: msg,
    });
  }
};
