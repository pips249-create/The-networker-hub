const { json, setCors } = require('../auth');
const { useSupabase } = require('../supabase');
const sbAuth = require('../supabase-auth');
const { enforceRateLimitAsync } = require('../rate-limit');
const { isRecipientAllowed } = require('../email-allowlist');

/**
 * Reset URLs must never leak in production API responses.
 * Opt-in only for non-production when AUTH_SHOW_RESET_LINK or AUTH_DEV_RESET_LINK is true.
 */
function shouldExposeResetLink() {
  if (String(process.env.VERCEL_ENV || '').toLowerCase() === 'production') return false;
  return (
    process.env.AUTH_SHOW_RESET_LINK === 'true' ||
    process.env.AUTH_DEV_RESET_LINK === 'true'
  );
}

async function handleSupabaseForgot(email) {
  const user = await sbAuth.findUserByEmail(email);
  if (!user) {
    return {
      status: 200,
      body: {
        ok: true,
        emailSent: false,
        accountFound: false,
        message:
          'If that email is registered, you can sign in. No account was found for this email.',
      },
    };
  }

  const emailsAllowed = await sbAuth.getEmailsEnabledForEmail(email);
  if (!emailsAllowed && !isRecipientAllowed(email)) {
    return {
      status: 200,
      body: {
        ok: true,
        emailSent: false,
        accountFound: true,
        emailsDisabled: true,
        message:
          'This account is not set up to receive emails yet. Ask your admin to enable emails, or use a password set by your admin.',
      },
    };
  }

  const { createPasswordResetLink, sendPasswordResetEmail } = require('../password-reset-email');
  let resetUrl = null;
  let emailSent = false;

  if (sbAuth.authEmailsEnabled()) {
    try {
      const sent = await sendPasswordResetEmail({
        email,
        userName: user.name || user.full_name || '',
      });
      emailSent = Boolean(sent?.ok);
      resetUrl = sent?.reset_url || null;
    } catch (e) {
      const code = e.code || '';
      if (code === 'resend_not_configured') {
        return {
          status: 503,
          body: {
            error: 'email_not_configured',
            message:
              'Password reset emails are not configured yet. Ask your admin to set RESEND_API_KEY and RESEND_FROM.',
          },
        };
      }
      return { status: 500, body: { error: 'server_error', message: e.message } };
    }
  }

  const showLinkOnPage = !emailSent && shouldExposeResetLink();

  if (!resetUrl && showLinkOnPage) {
    try {
      resetUrl = await createPasswordResetLink(email);
    } catch (e) {
      return { status: 500, body: { error: 'server_error', message: e.message } };
    }
  }

  return {
    status: 200,
    body: {
      ok: true,
      emailSent,
      accountFound: true,
      message: emailSent
        ? 'Check your email for a reset link (valid 15 minutes).'
        : showLinkOnPage
          ? 'Email is not configured yet — use the reset link shown below.'
          : 'Password reset emails are turned off. Ask your admin to set a new password, or use account settings after signing in.',
      ...(showLinkOnPage && resetUrl ? { resetUrl } : {}),
    },
  };
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

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

  if (!email) return json(res, 400, { error: 'missing_email' });

  const limited = await enforceRateLimitAsync(req, res, 'auth_forgot_password', { max: 6, windowMs: 300_000 });
  if (!limited.allowed) {
    return json(res, 429, {
      error: 'rate_limited',
      message: 'Too many reset requests. Please wait a few minutes and try again.',
      retryAfterSec: limited.retryAfterSec,
    });
  }

  if (!useSupabase()) {
    return json(res, 503, {
      error: 'not_configured',
      message: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.',
    });
  }

  try {
    const result = await handleSupabaseForgot(email);
    return json(res, result.status, result.body);
  } catch (e) {
    return json(res, 500, { error: 'server_error', message: e.message });
  }
};
