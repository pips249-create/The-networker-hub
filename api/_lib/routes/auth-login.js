const {
  verifyPassword,
  findUserByEmail,
  setSessionCookie,
  clearSessionCookie,
  json,
  sessionFromRequest,
  appendSystemLog,
  airtableConfig,
  setCors,
  normalizeRole,
  isAdminRole,
  hubViewFromRequest,
} = require('../auth');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const session = sessionFromRequest(req);
    return json(res, 200, { ok: !!session, user: session || null });
  }

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

  if (!email || !password) {
    return json(res, 400, { error: 'missing_credentials' });
  }

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return json(res, 401, {
        error: 'no_account',
        message:
          'No account exists for this email yet. An admin must run the one-time setup (see AUTH-SETUP.md) or use Forgot password only after your account exists.',
      });
    }
    if (!user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      return json(res, 401, {
        error: 'invalid_credentials',
        message: 'Password is incorrect. Try again or use Forgot password.',
      });
    }

    const role = normalizeRole(user.role);
    const sessionUser = {
      sub: user.id,
      email: user.email,
      role,
      name: user.name,
    };

    if (!setSessionCookie(res, sessionUser)) {
      return json(res, 503, { error: 'session_failed' });
    }

    await appendSystemLog(`User signed in: ${user.email}`, 'auth');

    let redirect = body.next || '/events/index.html';
    if (isAdminRole(role)) {
      redirect = '/admin/index.html';
    } else if (hubViewFromRequest(req) === 'organiser') {
      redirect = body.next || '/organiser/index.html';
    }

    return json(res, 200, {
      ok: true,
      user: sessionUser,
      redirect,
    });
  } catch (e) {
    return json(res, 500, {
      error: 'server_error',
      message: e.message,
      hint: 'Ensure your Airtable token can read/write the Users table.',
    });
  }
};
