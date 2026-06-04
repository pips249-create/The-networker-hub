const {
  hashPassword,
  findUserByResetToken,
  updateUser,
  json,
  appendSystemLog,
  airtableConfig,
} = require('../lib/auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const { apiKey, baseId } = airtableConfig();
  if (!apiKey || !baseId) return json(res, 503, { error: 'not_configured' });

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const token = String(body.token || '').trim();
  const password = String(body.password || '');

  if (!token || !password) return json(res, 400, { error: 'missing_fields' });
  if (password.length < 8) {
    return json(res, 400, { error: 'weak_password', message: 'Use at least 8 characters.' });
  }

  try {
    const user = await findUserByResetToken(token);
    if (!user) {
      return json(res, 400, { error: 'invalid_token', message: 'This reset link is invalid or expired.' });
    }

    const exp = user.resetExpires ? new Date(user.resetExpires).getTime() : 0;
    if (!exp || Date.now() > exp) {
      return json(res, 400, { error: 'expired_token', message: 'This reset link has expired.' });
    }

    await updateUser(user.id, {
      'Password Hash': hashPassword(password),
      'Reset Token': '',
      'Reset Token Expires': '',
    });

    await appendSystemLog(`Password updated for ${user.email}`, 'auth');

    return json(res, 200, { ok: true, message: 'Password updated. You can sign in now.' });
  } catch (e) {
    return json(res, 500, { error: 'server_error', message: e.message });
  }
};
