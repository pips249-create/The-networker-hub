const { json, cleanEnvVal, isAdminRole } = require('../auth');
const { isSupabaseConfigured } = require('../supabase');
const sbAuth = require('../supabase-auth');
const { timingSafeEqualString } = require('../crypto-utils');

/**
 * One-time admin setup. POST with:
 * { "secret": "<ADMIN_SETUP_SECRET>", "email": "...", "password": "..." }
 *
 * In production, disabled once an admin account already exists — remove ADMIN_SETUP_SECRET from Vercel.
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const setupSecret = String(process.env.ADMIN_SETUP_SECRET || '').trim();
  if (!setupSecret) {
    return json(res, 503, {
      error: 'not_configured',
      message: 'Set ADMIN_SETUP_SECRET in Vercel, then call this endpoint once.',
    });
  }

  if (!isSupabaseConfigured()) {
    return json(res, 503, { error: 'supabase_not_configured' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  if (!timingSafeEqualString(String(body.secret || ''), setupSecret)) {
    return json(res, 403, { error: 'forbidden' });
  }

  const isProduction = process.env.VERCEL_ENV === 'production';
  if (isProduction) {
    const adminEmail = cleanEnvVal(process.env.ADMIN_EMAIL) || 'pips249@gmail.com';
    try {
      const existing = await sbAuth.findUserByEmail(adminEmail);
      if (existing && isAdminRole(existing.role)) {
        return json(res, 403, {
          error: 'bootstrap_complete',
          message:
            'Admin account already exists in production. Remove ADMIN_SETUP_SECRET from Vercel env vars.',
        });
      }
    } catch {
      /* allow setup if lookup fails */
    }
  }

  const email = String(body.email || process.env.ADMIN_EMAIL || 'pips249@gmail.com')
    .trim()
    .toLowerCase();
  const password = String(body.password || process.env.ADMIN_INITIAL_PASSWORD || '');
  const name = String(body.name || 'Platform Admin').trim();

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
    const admin = await sbAuth.ensureAdminUser({ email, password, name });
    return json(res, 200, {
      ok: true,
      message: 'Admin account is ready in Supabase.',
      email: admin.email,
      provider: 'supabase',
    });
  } catch (e) {
    return json(res, 500, { error: 'setup_failed', message: e.message });
  }
};
