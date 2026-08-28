const {
  json,
  setCors,
  sessionFromRequest,
  setSessionCookie,
  findUserByEmail,
  updateUser,
  hashPassword,
  verifyPassword,
  USER_FIELDS,
  USER_PROFILE_FIELDS,
  fieldNameOnRecord,
  resolveProfileFieldName,
  getUsersTableFieldNames,
  profileWritableFlags,
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

function publicProfile(user) {
  return {
    email: user.email,
    name: user.name || '',
    location: user.location || '',
    company: user.company || '',
    jobTitle: user.jobTitle || '',
    marketPreferences: user.marketPreferences || '',
    businessSector: user.businessSector || '',
  };
}

async function buildProfilePatch(user, body) {
  const f = user.fields || {};
  const tableFields = await getUsersTableFieldNames();
  const patch = {};
  const skipped = [];

  if (body.name !== undefined) {
    const key = resolveProfileFieldName(f, USER_FIELDS.name, tableFields);
    if (key) patch[key] = String(body.name || '').trim();
    else skipped.push('name');
  }
  if (body.location !== undefined) {
    const key = resolveProfileFieldName(f, USER_PROFILE_FIELDS.location, tableFields);
    if (key) patch[key] = String(body.location || '').trim();
    else skipped.push('location');
  }
  if (body.company !== undefined) {
    const key = resolveProfileFieldName(f, USER_PROFILE_FIELDS.company, tableFields);
    if (key) patch[key] = String(body.company || '').trim();
    else skipped.push('company');
  }
  if (body.jobTitle !== undefined) {
    const key = resolveProfileFieldName(f, USER_PROFILE_FIELDS.jobTitle, tableFields);
    if (key) patch[key] = String(body.jobTitle || '').trim();
    else skipped.push('jobTitle');
  }
  if (body.marketPreferences !== undefined) {
    const key = resolveProfileFieldName(f, USER_PROFILE_FIELDS.marketPreferences, tableFields);
    if (key) patch[key] = String(body.marketPreferences || '').trim();
    else skipped.push('marketPreferences');
  }
  if (body.businessSector !== undefined) {
    const key = resolveProfileFieldName(f, USER_PROFILE_FIELDS.businessSector, tableFields);
    if (key) patch[key] = String(body.businessSector || '').trim();
    else skipped.push('businessSector');
  }

  return { patch, skipped };
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

  try {
    if (useSupabase()) {
      return handleSupabase(req, res, session);
    }

    const user = await findUserByEmail(session.email);
    if (!user) {
      return json(res, 404, { error: 'user_not_found' });
    }

    const tableFields = await getUsersTableFieldNames();
    const writable = profileWritableFlags(user, tableFields);

    if (req.method === 'GET') {
      return json(res, 200, { ok: true, profile: publicProfile(user), writable });
    }

    if (req.method === 'PATCH') {
      const body = parseBody(req);
      const { patch, skipped } = await buildProfilePatch(user, body);
      if (!Object.keys(patch).length) {
        const labels = {
          name: 'Name',
          location: 'Location (or City)',
          company: 'Company',
          jobTitle: 'Job Title',
          marketPreferences: 'Market Preferences',
          businessSector: 'Business Sector',
        };
        const missing = skipped.map((k) => labels[k] || k).join(', ');
        return json(res, 400, {
          error: 'fields_not_configured',
          message: missing
            ? `These columns are not set up in your Airtable Users table yet: ${missing}. Add them in Airtable, or save only the fields that are available.`
            : 'Nothing to update.',
          skipped,
          writable,
        });
      }
      const updated = await updateUser(user.id, patch);
      const profile = publicProfile(updated);
      const response = { ok: true, profile, writable };
      if (skipped.length) {
        response.partial = true;
        response.skipped = skipped;
        response.message =
          'Some details were saved. To store location or preferences, add the matching columns to your Airtable Users table.';
      } else {
        response.message = 'Your details were saved.';
      }
      if (profile.name && profile.name !== session.name) {
        setSessionCookie(res, {
          sub: session.sub,
          email: session.email,
          role: session.role,
          name: profile.name,
        });
      }
      return json(res, 200, response);
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
    return json(res, e.status || 500, {
      error: e.code || 'server_error',
      message: e.message || 'Could not update your account.',
    });
  }
};
