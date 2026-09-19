const { setSessionCookie, json, setCors, hubViewFromRequest } = require('../auth');
const { useSupabase } = require('../supabase');
const sbAuth = require('../supabase-auth');
const { sendAccountWelcomeEmail } = require('../account-emails');
const { enforceRateLimitAsync, clientIp } = require('../rate-limit');
const { verifyTurnstileToken } = require('../turnstile');
const { validateNewPassword } = require('../password-policy');
const { getOrganiserAccessStatus } = require('../organiser-access-guard');
const { sendOrganiserEmailVerification } = require('../organiser-email-verification');
const {
  isOrganiserAuthIntent,
  isOrganiserClaimNext,
  maybeAutoEnableOrganiserAccess,
  redirectAfterOrganiserAuth,
  buildEmailVerifyRedirect,
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
  const termsAccepted =
    body.termsAccepted === true ||
    body.terms_accepted === true ||
    body.terms === true ||
    body.terms === 'true';

  if (!email || !password) {
    return json(res, 400, {
      error: 'missing_fields',
      message: 'Enter your email and a password.',
    });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(res, 400, { error: 'invalid_email', message: 'Enter a valid email address.' });
  }
  const passwordCheck = validateNewPassword(password);
  if (!passwordCheck.ok) {
    return json(res, 400, {
      error: passwordCheck.error,
      message: passwordCheck.message,
    });
  }
  if (!termsAccepted) {
    return json(res, 400, {
      error: 'terms_required',
      message: 'Please agree to the Terms & conditions and Privacy policy.',
    });
  }

  const limited = await enforceRateLimitAsync(req, res, 'auth_register', { max: 8, windowMs: 300_000 });
  if (!limited.allowed) {
    return json(res, 429, {
      error: 'rate_limited',
      message: 'Too many sign-up attempts. Please wait a few minutes and try again.',
      retryAfterSec: limited.retryAfterSec,
    });
  }

  const captcha = await verifyTurnstileToken(
    body.turnstileToken || body['cf-turnstile-response'],
    clientIp(req)
  );
  if (!captcha.ok) {
    return json(res, 400, {
      error: captcha.error || 'captcha_failed',
      message: 'Please complete the security check and try again.',
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
        // Register owns the verification email so we do not send twice.
        autoEnable = await maybeAutoEnableOrganiserAccess(sessionUser, res, {
          skipVerificationEmail: true,
        });
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

    const accessStatus = await getOrganiserAccessStatus(sessionUser);
    let emailSent = false;
    let verifyCode = null;
    const requiresEmailVerification = !accessStatus.organiserEmailVerified;

    if (requiresEmailVerification) {
      const afterVerify = redirect;
      try {
        const sent = await sendOrganiserEmailVerification({
          userId: sessionUser.sub,
          email: sessionUser.email,
          name: sessionUser.name,
        });
        emailSent = true;
        const codeMatch = String(sent.verifyPath || '').match(/[?&]code=([^&]+)/);
        verifyCode = codeMatch ? decodeURIComponent(codeMatch[1]) : null;
      } catch (e) {
        verifyCode = e.verifyCode || null;
      }
      redirect = buildEmailVerifyRedirect({
        next: afterVerify,
        code: verifyCode,
        email: sessionUser.email,
      });
    }

    return json(res, 201, {
      ok: true,
      message: requiresEmailVerification
        ? emailSent
          ? 'Account created — check your email for a confirmation code.'
          : 'Account created — confirm your email to continue.'
        : 'Your account has been created.',
      user: sessionUser,
      redirect,
      requiresEmailVerification,
      emailSent,
      // Only expose code when delivery failed so signup can still complete.
      verifyCode: emailSent ? null : verifyCode,
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
