const {
  hashPassword,
  findUserByResetToken,
  updateUser,
  json,
  appendSystemLog,
  airtableConfig,
  USER_FIELDS,
} = require('../lib/auth');

function fieldNameOnRecord(recordFields, candidates, fallback) {
  const f = recordFields || {};
  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(f, key)) return key;
  }
  return fallback;
}

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

    const passwordField = fieldNameOnRecord(
      user.fields,
      USER_FIELDS.passwordHash,
      'Password Hash'
    );

    await updateUser(user.id, {
      [passwordField]: hashPassword(password),
    });

    try {
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
        [resetTokenField]: null,
        [resetExpiresField]: null,
      });
    } catch {
      /* password saved; clearing token fields is optional */
    }

    await appendSystemLog(`Password updated for ${user.email}`, 'auth');

    return json(res, 200, { ok: true, message: 'Password updated. You can sign in now.' });
  } catch (e) {
    const msg = e.message || 'Could not update password.';
    return json(res, 500, {
      error: 'update_failed',
      message: msg.includes('update_failed') ? 'Could not save to Airtable. Check Users table field names.' : msg,
    });
  }
};
