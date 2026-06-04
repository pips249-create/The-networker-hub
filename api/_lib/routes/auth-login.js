const {
  setSessionCookie,
  json,
  sessionFromRequest,
  setCors,
  normalizeRole,
  isAdminRole,
  hubViewFromRequest,
} = require('../auth');
const { useSupabase } = require('../supabase');
const sbAuth = require('../supabase-auth');

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

  if (!process.env.SESSION_SECRET) {
    return json(res, 503, {
      error: 'not_configured',
      message: 'Set SESSION_SECRET in Vercel (random 32+ character string).',
    });
  }

  if (!useSupabase()) {
    return json(res, 503, {
      error: 'not_configured',
      message: 'Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_ANON_KEY. See SUPABASE-FRESH-START.md.',
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
    const login = await sbAuth.verifyLogin(email, password);
    if (!login.ok) {
      return json(res, 401, {
        error: 'invalid_credentials',
        message: 'Email or password is incorrect.',
      });
    }

    const user = await sbAuth.findUserByEmail(email);
    if (!user) {
      return json(res, 401, { error: 'no_account', message: 'No account for this email.' });
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
    });
  }
};
