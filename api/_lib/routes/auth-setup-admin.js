const {
  hashPassword,
  findUserByEmail,
  createUser,
  updateUser,
  json,
  airtableConfig,
  normalizeRole,
  USER_ROLES,
} = require('../auth');

/**
 * One-time admin setup. POST with:
 * { "secret": "<ADMIN_SETUP_SECRET>", "email": "pips249@gmail.com", "password": "..." }
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const setupSecret = process.env.ADMIN_SETUP_SECRET;
  if (!setupSecret) {
    return json(res, 503, {
      error: 'not_configured',
      message: 'Set ADMIN_SETUP_SECRET in Vercel, then call this endpoint once.',
    });
  }

  const { apiKey, baseId } = airtableConfig();
  if (!apiKey || !baseId) return json(res, 503, { error: 'airtable_not_configured' });

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  if (body.secret !== setupSecret) {
    return json(res, 403, { error: 'forbidden' });
  }

  const email = String(body.email || process.env.ADMIN_EMAIL || 'pips249@gmail.com')
    .trim()
    .toLowerCase();
  const password = String(body.password || process.env.ADMIN_INITIAL_PASSWORD || '');
  const name = String(body.name || 'Platform Admin').trim();
  let role = normalizeRole(body.role || USER_ROLES.ADMIN);
  if (![USER_ROLES.ADMIN, USER_ROLES.CLIENT].includes(role)) {
    return json(res, 400, {
      error: 'invalid_role',
      message: 'role must be admin or client',
    });
  }

  if (!email || !password) {
    return json(res, 400, {
      error: 'missing_fields',
      message: 'Provide email and password in the body, or set ADMIN_INITIAL_PASSWORD.',
    });
  }
  if (password.length < 8) {
    return json(res, 400, { error: 'weak_password', message: 'Use at least 8 characters.' });
  }

  try {
    const hash = hashPassword(password);
    const existing = await findUserByEmail(email);

    if (existing) {
      await updateUser(existing.id, {
        'Password Hash': hash,
        Role: role,
        Name: name,
      });
      return json(res, 200, {
        ok: true,
        message: 'User account updated.',
        email,
        role,
      });
    }

    await createUser({
      email,
      passwordHash: hash,
      role,
      name,
    });

    return json(res, 201, {
      ok: true,
      message: 'User account created.',
      email,
      role,
    });
  } catch (e) {
    return json(res, 500, {
      error: 'server_error',
      message: e.message,
      hint: 'Create a Users table in Airtable with Email, Password Hash, Role, Name, Reset Token, Reset Token Expires.',
    });
  }
};
