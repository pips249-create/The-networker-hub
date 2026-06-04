const {
  hashPassword,
  findUserByEmail,
  createUser,
  setSessionCookie,
  json,
  setCors,
  appendSystemLog,
  airtableConfig,
  USER_ROLES,
  hubViewFromRequest,
} = require('../auth');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const { apiKey, baseId } = airtableConfig();
  if (!apiKey || !baseId) {
    return json(res, 503, {
      error: 'not_configured',
      message: 'Set AIRTABLE_API_KEY and AIRTABLE_BASE_ID in Vercel.',
    });
  }
  if (!process.env.SESSION_SECRET) {
    return json(res, 503, {
      error: 'not_configured',
      message: 'Set SESSION_SECRET in Vercel (random 32+ character string).',
    });
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
  const password = String(body.password || '');
  const name = String(body.name || '').trim();

  if (!email || !password) {
    return json(res, 400, {
      error: 'missing_fields',
      message: 'Enter your email and a password.',
    });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(res, 400, { error: 'invalid_email', message: 'Enter a valid email address.' });
  }
  if (password.length < 8) {
    return json(res, 400, {
      error: 'weak_password',
      message: 'Password must be at least 8 characters.',
    });
  }

  try {
    const existing = await findUserByEmail(email);
    if (existing) {
      return json(res, 409, {
        error: 'email_exists',
        message: 'An account with this email already exists. Sign in instead.',
      });
    }

    const user = await createUser({
      email,
      passwordHash: hashPassword(password),
      role: USER_ROLES.CLIENT,
      name,
    });

    const sessionUser = {
      sub: user.id,
      email: user.email,
      role: USER_ROLES.CLIENT,
      name: user.name || name || '',
    };

    if (!setSessionCookie(res, sessionUser)) {
      return json(res, 503, { error: 'session_failed' });
    }

    await appendSystemLog(`New account registered: ${user.email}`, 'auth');

    let redirect = body.next || '/account/index.html';
    if (hubViewFromRequest(req) === 'organiser') {
      redirect = body.next || '/organiser/index.html';
    }

    return json(res, 201, {
      ok: true,
      message: 'Your account has been created.',
      user: sessionUser,
      redirect,
    });
  } catch (e) {
    return json(res, 500, {
      error: 'register_failed',
      message: e.message || 'Could not create your account.',
      hint:
        'Ensure your Airtable Users table has Email and Password Hash. The Role field must already include an option such as Client or Member (the API cannot add new select options).',
    });
  }
};
