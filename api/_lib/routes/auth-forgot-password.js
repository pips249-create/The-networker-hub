const crypto = require('crypto');
const {
  findUserByEmail,
  updateUser,
  json,
  airtableConfig,
  appendSystemLog,
  USER_FIELDS,
  setCors,
} = require('../auth');
const { useSupabase } = require('../supabase');
const sbAuth = require('../supabase-auth');

function fieldNameOnRecord(recordFields, candidates, fallback) {
  const f = recordFields || {};
  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(f, key)) return key;
  }
  return fallback;
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
  if (!emailsAllowed) {
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

  if (sbAuth.authEmailsEnabled()) {
    const { getSupabaseAdmin } = require('../supabase');
    const sb = getSupabaseAdmin();
    const host = process.env.SITE_URL || 'https://the-networker-hub.vercel.app';
    const { data, error } = await sb.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${host}/reset-password.html` },
    });
    if (error) {
      return { status: 500, body: { error: 'server_error', message: error.message } };
    }
    return {
      status: 200,
      body: {
        ok: true,
        emailSent: true,
        accountFound: true,
        message: 'Check your email for a reset link.',
      },
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      emailSent: false,
      accountFound: true,
      message:
        'Password reset emails are turned off. Ask your admin to set a new password, or use account settings after signing in.',
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

  if (useSupabase()) {
    try {
      const result = await handleSupabaseForgot(email);
      return json(res, result.status, result.body);
    } catch (e) {
      return json(res, 500, { error: 'server_error', message: e.message });
    }
  }

  const { apiKey, baseId } = airtableConfig();
  if (!apiKey || !baseId) {
    return json(res, 503, { error: 'not_configured' });
  }

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return json(res, 200, {
        ok: true,
        emailSent: false,
        accountFound: false,
        message:
          'If that email is registered, you will receive reset instructions. No account was found for this email — your admin may need to create it first (see setup below).',
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const resetTokenField = fieldNameOnRecord(
      user.fields,
      USER_FIELDS.resetToken,
      'Reset Token'
    );
    const resetExpiresField = fieldNameOnRecord(
      user.fields,
      USER_FIELDS.resetExpires,
      'Reset Token Expires'
    );
    await updateUser(user.id, {
      [resetTokenField]: token,
      [resetExpiresField]: expires,
    });

    const host = process.env.SITE_URL || 'https://the-networker-hub.vercel.app';
    const resetUrl = `${host}/reset-password.html?token=${token}`;

    await appendSystemLog(`Password reset requested for ${email}`, 'auth');

    const resendKey = process.env.RESEND_API_KEY;
    let emailSent = false;
    if (resendKey && sbAuth.authEmailsEnabled()) {
      const mail = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'The Networker Hub <onboarding@resend.dev>',
          to: [email],
          subject: 'Reset your Networker Hub password',
          html: `<p>Click to reset your password (valid 1 hour):</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
        }),
      });
      emailSent = mail.ok;
    }

    const showLinkOnPage =
      !emailSent &&
      (process.env.AUTH_SHOW_RESET_LINK !== 'false' ||
        process.env.AUTH_DEV_RESET_LINK === 'true');

    return json(res, 200, {
      ok: true,
      emailSent,
      accountFound: true,
      message: emailSent
        ? 'Check your email for a reset link (valid 1 hour).'
        : 'Email is not configured yet — use the reset link shown below.',
      ...(showLinkOnPage ? { resetUrl } : {}),
    });
  } catch (e) {
    return json(res, 500, { error: 'server_error', message: e.message });
  }
};
