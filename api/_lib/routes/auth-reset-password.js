const { json, appendSystemLog, setCors } = require('../auth');
const { useSupabase, getSupabaseAdmin, getSupabaseAnon } = require('../supabase');
const { enforceRateLimitAsync } = require('../rate-limit');
const { validateNewPassword } = require('../password-policy');

async function finishSupabasePasswordUpdate(userId, email, password) {
  const { error: updateError } = await getSupabaseAdmin().auth.admin.updateUserById(userId, {
    password,
  });
  if (updateError) {
    return {
      status: 500,
      body: { error: 'update_failed', message: updateError.message || 'Could not update password.' },
    };
  }

  try {
    await appendSystemLog(`Password updated for ${email || userId}`, 'auth');
  } catch {
    /* optional */
  }

  return {
    status: 200,
    body: { ok: true, message: 'Password updated. You can sign in now.' },
  };
}

/** Hub-hosted reset links (?token_hash=) — bypasses broken Supabase Auth Site URL redirects. */
async function handleSupabaseResetWithTokenHash(tokenHash, password) {
  const anon = getSupabaseAnon();
  const { data, error } = await anon.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'recovery',
  });
  if (error || !data?.user?.id) {
    return {
      status: 400,
      body: {
        error: 'invalid_token',
        message: 'This reset link is invalid or expired. Request a new one from Forgot password.',
      },
    };
  }

  const email = String(data.user.email || '').trim().toLowerCase();
  return finishSupabasePasswordUpdate(data.user.id, email, password);
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

  const email = String(data.user.email || '').trim().toLowerCase();
  return finishSupabasePasswordUpdate(data.user.id, email, password);
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
  const tokenHash = String(body.token_hash || body.tokenHash || '').trim();
  const password = String(body.password || '');

  if (!password) return json(res, 400, { error: 'missing_fields' });

  const limited = await enforceRateLimitAsync(req, res, 'auth_reset_password', {
    max: 10,
    windowMs: 900_000,
  });
  if (!limited.allowed) {
    return json(res, 429, {
      error: 'rate_limited',
      message: 'Too many password reset attempts. Please wait a few minutes and try again.',
      retryAfterSec: limited.retryAfterSec,
    });
  }

  const passwordCheck = validateNewPassword(password);
  if (!passwordCheck.ok) {
    return json(res, 400, {
      error: passwordCheck.error,
      message: passwordCheck.message,
    });
  }

  if (!useSupabase()) {
    return json(res, 503, {
      error: 'not_configured',
      message: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.',
    });
  }

  if (!accessToken && !tokenHash) {
    return json(res, 400, {
      error: 'missing_token',
      message: 'Missing reset token. Request a new link from Forgot password.',
    });
  }

  try {
    const result = tokenHash
      ? await handleSupabaseResetWithTokenHash(tokenHash, password)
      : await handleSupabaseReset(accessToken, password);
    return json(res, result.status, result.body);
  } catch (e) {
    return json(res, 500, {
      error: 'update_failed',
      message: e.message || 'Could not update password.',
    });
  }
};
