const crypto = require('crypto');
const {
  findUserByEmail,
  updateUser,
  json,
  airtableConfig,
  appendSystemLog,
} = require('../lib/auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const { apiKey, baseId } = airtableConfig();
  if (!apiKey || !baseId) {
    return json(res, 503, { error: 'not_configured' });
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
  const genericOk = {
    ok: true,
    message: 'If that email is registered, you will receive reset instructions shortly.',
  };

  if (!email) return json(res, 400, { error: 'missing_email' });

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

    await updateUser(user.id, {
      'Reset Token': token,
      'Reset Token Expires': expires,
    });

    const host = process.env.SITE_URL || 'https://the-networker-hub.vercel.app';
    const resetUrl = `${host}/reset-password.html?token=${token}`;

    await appendSystemLog(`Password reset requested for ${email}`, 'auth');

    const resendKey = process.env.RESEND_API_KEY;
    let emailSent = false;
    if (resendKey) {
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
