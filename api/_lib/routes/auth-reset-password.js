const {
  hashPassword,
  findUserByResetToken,
  updateUser,
  json,
  appendSystemLog,
  airtableConfig,
  USER_FIELDS,
  setCors,
} = require('../auth');
const { useSupabase, getSupabaseAdmin } = require('../supabase');

function fieldNameOnRecord(recordFields, candidates, fallback) {
  const f = recordFields || {};
  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(f, key)) return key;
  }
  return fallback;
}

async function handleSupabaseReset(accessToken, password) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.auth.getUser(accessToken);
  if (error || !data?.user?.id) {
    return {
      status: 400,
      body: {
        error: 'invalid_token',
        message: 'This reset link is invalid or expired. Request a new one from Forgot password.',
      },
    };
  }

  const { error: updateError } = await sb.auth.admin.updateUserById(data.user.id, { password });
  if (updateError) {
    return {
      status: 500,
      body: { error: 'update_failed', message: updateError.message || 'Could not update password.' },
    };
  }

  const email = String(data.user.email || '').trim().toLowerCase();
  try {
    await appendSystemLog(`Password updated for ${email || data.user.id}`, 'auth');
  } catch {
    /* optional */
  }

  return {
    status: 200,
    body: { ok: true, message: 'Password updated. You can sign in now.' },
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

  const accessToken = String(body.accessToken || body.access_token || '').trim();
  const token = String(body.token || '').trim();
  const password = String(body.password || '');

  if (!password) return json(res, 400, { error: 'missing_fields' });
  if (password.length < 8) {
    return json(res, 400, { error: 'weak_password', message: 'Use at least 8 characters.' });
  }

  if (useSupabase()) {
    if (!accessToken) {
      return json(res, 400, {
        error: 'missing_token',
        message: 'Missing reset token. Request a new link from Forgot password.',
      });
    }
    try {
      const result = await handleSupabaseReset(accessToken, password);
      return json(res, result.status, result.body);
    } catch (e) {
      return json(res, 500, {
        error: 'update_failed',
        message: e.message || 'Could not update password.',
      });
    }
  }

  const { apiKey, baseId } = airtableConfig();
  if (!apiKey || !baseId) return json(res, 503, { error: 'not_configured' });

  if (!token) return json(res, 400, { error: 'missing_fields' });

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
      message: msg.includes('update_failed')
        ? 'Could not save to Airtable. Check Users table field names.'
        : msg,
    });
  }
};
