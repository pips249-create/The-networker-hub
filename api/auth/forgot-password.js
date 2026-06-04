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
    if (!user) return json(res, 200, genericOk);

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
    if (resendKey) {
      await fetch('https://api.resend.com/emails', {
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
    }

    const devLink =
      process.env.AUTH_DEV_RESET_LINK === 'true' || process.env.VERCEL_ENV === 'preview';

    return json(res, 200, {
      ...genericOk,
      ...(devLink ? { devResetUrl: resetUrl } : {}),
      emailSent: Boolean(resendKey),
    });
  } catch (e) {
    return json(res, 500, { error: 'server_error', message: e.message });
  }
};
