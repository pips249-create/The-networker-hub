const {
  json,
  setCors,
  sessionFromRequest,
  setSessionCookie,
} = require('../auth');
const { useSupabase } = require('../supabase');
const sbProfile = require('../supabase-profile');
const { validateNewPassword } = require('../password-policy');

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body || {};
}

async function handleSupabase(req, res, session) {
  if (req.method === 'GET') {
    const { profile, writable, profileComplete } = await sbProfile.getProfile(session);
    return json(res, 200, { ok: true, profile, writable, profileComplete: !!profileComplete });
  }

  if (req.method === 'PATCH') {
    const body = parseBody(req);
    const result = await sbProfile.updateProfile(session, body);
    if (result.profile.name && result.profile.name !== session.name) {
      setSessionCookie(res, {
        sub: session.sub,
        email: session.email,
        role: session.role,
        name: result.profile.name,
      });
    }
    return json(res, 200, {
      ok: true,
      profile: result.profile,
      writable: result.writable,
      profileComplete: !!result.profileComplete,
      message: result.message,
    });
  }

  if (req.method === 'POST') {
    const body = parseBody(req);
    if (body.action !== 'change-password') {
      return json(res, 400, { error: 'invalid_action' });
    }

    const current = String(body.currentPassword || '');
    const next = String(body.newPassword || '');
    if (!current || !next) {
      return json(res, 400, { error: 'missing_fields' });
    }
    const passwordCheck = validateNewPassword(next);
    if (!passwordCheck.ok) {
      return json(res, 400, {
        error: passwordCheck.error,
        message: passwordCheck.message,
      });
    }

    try {
      const result = await sbProfile.changePassword(session, current, next);
      return json(res, 200, { ok: true, message: result.message });
    } catch (e) {
      if (e.code === 'wrong_password' || e.status === 403) {
        return json(res, 403, {
          error: 'wrong_password',
          message: e.message || 'Current password is incorrect.',
        });
      }
      throw e;
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = sessionFromRequest(req);
  if (!session || !session.email) {
    return json(res, 401, { error: 'not_authenticated' });
  }

  if (!useSupabase()) {
    return json(res, 503, {
      error: 'not_configured',
      message: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.',
    });
  }

  try {
    return await handleSupabase(req, res, session);
  } catch (e) {
    return json(res, 500, { error: 'profile_failed', message: e.message || 'Could not update profile.' });
  }
};
