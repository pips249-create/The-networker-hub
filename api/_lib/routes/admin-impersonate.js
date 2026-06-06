const {
  sessionFromRequest,
  requireAdmin,
  json,
  setCors,
  setSessionCookie,
  normalizeRole,
  appendSystemLog,
} = require('../auth');
const { useSupabase } = require('../supabase');
const sbAuth = require('../supabase-auth');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  if (!process.env.SESSION_SECRET) {
    return json(res, 503, { error: 'not_configured', message: 'Set SESSION_SECRET in Vercel.' });
  }

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error, message: gate.message });

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
  if (!email) {
    return json(res, 400, { error: 'missing_email', message: 'Enter a user email address.' });
  }

  if (email === String(session.email || '').toLowerCase()) {
    return json(res, 400, {
      error: 'same_user',
      message: 'You are already signed in as this account.',
    });
  }

  try {
    let target = null;

    if (useSupabase()) {
      target = await sbAuth.findUserByEmail(email);
    } else {
      const { findUserByEmail } = require('../auth');
      target = await findUserByEmail(email);
    }

    if (!target) {
      return json(res, 404, {
        error: 'user_not_found',
        message: 'No account found with that email address.',
      });
    }

    const targetRole = normalizeRole(target.role);
    if (targetRole === 'admin') {
      return json(res, 403, {
        error: 'cannot_impersonate_admin',
        message: 'Admin accounts cannot be impersonated.',
      });
    }

    const impersonator = {
      sub: session.sub,
      email: session.email,
      role: session.role,
      name: session.name || '',
    };

    const sessionUser = {
      sub: target.id,
      email: target.email,
      role: targetRole,
      name: target.name || '',
      impersonator,
    };

    if (!setSessionCookie(res, sessionUser)) {
      return json(res, 503, { error: 'session_failed' });
    }

    await appendSystemLog(
      `Admin ${session.email} started impersonating ${target.email}`,
      'security'
    );

    const redirect =
      body.redirect ||
      (body.view === 'organiser'
        ? '/organiser/index.html'
        : body.view === 'events'
          ? '/events/index.html'
          : '/account/index.html');

    return json(res, 200, {
      ok: true,
      message: `Now viewing as ${target.email}.`,
      redirect,
      user: {
        sub: sessionUser.sub,
        email: sessionUser.email,
        role: sessionUser.role,
        name: sessionUser.name,
      },
      impersonating: true,
      impersonatorEmail: impersonator.email,
    });
  } catch (e) {
    return json(res, 500, {
      error: 'impersonate_failed',
      message: e.message || 'Could not impersonate that user.',
    });
  }
};
