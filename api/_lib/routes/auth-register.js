const { setSessionCookie, json, setCors, hubViewFromRequest } = require('../auth');
const { useSupabase } = require('../supabase');
const sbAuth = require('../supabase-auth');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  if (!process.env.SESSION_SECRET) {
    return json(res, 503, {
      error: 'not_configured',
      message: 'Set SESSION_SECRET in Vercel.',
    });
  }

  if (!useSupabase()) {
    return json(res, 503, {
      error: 'not_configured',
      message: 'Supabase is not configured. See SUPABASE-FRESH-START.md.',
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
    const user = await sbAuth.registerUser({ email, password, name });

    const sessionUser = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name || name || '',
    };

    if (!setSessionCookie(res, sessionUser)) {
      return json(res, 503, { error: 'session_failed' });
    }

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
    const msg = e.message || 'Could not create your account.';
    const code = /already exists/i.test(msg) ? 'email_exists' : 'register_failed';
    return json(res, code === 'email_exists' ? 409 : 500, {
      error: code,
      message: msg,
    });
  }
};
