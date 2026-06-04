const {
  json,
  setCors,
  sessionFromRequest,
  findUserByEmail,
  updateUser,
  hashPassword,
  verifyPassword,
  USER_FIELDS,
  USER_PROFILE_FIELDS,
  fieldNameOnRecord,
} = require('../auth');

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

function publicProfile(user) {
  return {
    email: user.email,
    name: user.name || '',
    location: user.location || '',
    marketPreferences: user.marketPreferences || '',
    businessSector: user.businessSector || '',
  };
}

function buildProfilePatch(user, body) {
  const f = user.fields || {};
  const patch = {};

  if (body.name !== undefined) {
    const key = fieldNameOnRecord(f, USER_FIELDS.name, 'Name');
    patch[key] = String(body.name || '').trim();
  }
  if (body.location !== undefined) {
    const key = fieldNameOnRecord(f, USER_PROFILE_FIELDS.location, 'Location');
    patch[key] = String(body.location || '').trim();
  }
  if (body.marketPreferences !== undefined) {
    const key = fieldNameOnRecord(f, USER_PROFILE_FIELDS.marketPreferences, 'Market Preferences');
    patch[key] = String(body.marketPreferences || '').trim();
  }
  if (body.businessSector !== undefined) {
    const key = fieldNameOnRecord(f, USER_PROFILE_FIELDS.businessSector, 'Business Sector');
    patch[key] = String(body.businessSector || '').trim();
  }

  return patch;
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

  try {
    const user = await findUserByEmail(session.email);
    if (!user) {
      return json(res, 404, { error: 'user_not_found' });
    }

    if (req.method === 'GET') {
      return json(res, 200, { ok: true, profile: publicProfile(user) });
    }

    if (req.method === 'PATCH') {
      const body = parseBody(req);
      const patch = buildProfilePatch(user, body);
      if (!Object.keys(patch).length) {
        return json(res, 400, { error: 'no_fields', message: 'Nothing to update.' });
      }
      const updated = await updateUser(user.id, patch);
      return json(res, 200, { ok: true, profile: publicProfile(updated) });
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
      if (next.length < 8) {
        return json(res, 400, {
          error: 'weak_password',
          message: 'New password must be at least 8 characters.',
        });
      }
      if (!user.passwordHash || !verifyPassword(current, user.passwordHash)) {
        return json(res, 403, {
          error: 'wrong_password',
          message: 'Current password is incorrect.',
        });
      }

      const passwordField = fieldNameOnRecord(
        user.fields,
        USER_FIELDS.passwordHash,
        'Password Hash'
      );
      await updateUser(user.id, { [passwordField]: hashPassword(next) });
      return json(res, 200, { ok: true, message: 'Password updated.' });
    }

    return json(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    return json(res, 500, {
      error: 'server_error',
      message: e.message || 'Could not update your account.',
    });
  }
};
