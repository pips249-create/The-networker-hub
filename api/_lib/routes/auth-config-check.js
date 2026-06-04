const { cleanEnvVal } = require('../auth');
const {
  supabaseConfig,
  testSupabaseConnection,
  dataProvider,
  isSupabaseConfigured,
} = require('../supabase');
const sbAuth = require('../supabase-auth');

/**
 * Safe diagnostic: which env vars are set (never returns secret values).
 * Supabase-only — Airtable is optional legacy.
 */
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const sbCfg = supabaseConfig();
  const provider = dataProvider();

  const env = {
    hasSessionSecret: Boolean(process.env.SESSION_SECRET),
    hasAdminEmail: Boolean(process.env.ADMIN_EMAIL),
    hasAdminInitialPassword: Boolean(process.env.ADMIN_INITIAL_PASSWORD),
    hasAdminSetupSecret: Boolean(process.env.ADMIN_SETUP_SECRET),
    hasSiteUrl: Boolean(process.env.SITE_URL),
    dataProvider: provider,
    hasSupabaseUrl: Boolean(sbCfg.url),
    hasSupabaseServiceKey: Boolean(sbCfg.serviceKey),
    hasSupabaseAnonKey: Boolean(sbCfg.anonKey),
  };

  const authReady =
    env.hasSessionSecret &&
    env.hasSupabaseUrl &&
    env.hasSupabaseServiceKey &&
    env.hasSupabaseAnonKey;

  const canSeedAdmin = authReady && env.hasAdminInitialPassword;

  const supabase = isSupabaseConfigured() ? await testSupabaseConnection() : { ok: false, configured: false };

  const adminEmail = cleanEnvVal(process.env.ADMIN_EMAIL) || 'pips249@gmail.com';
  let adminAccount = { email: adminEmail, exists: false, hasPassword: false, role: null };
  if (supabase.ok) {
    try {
      const u = await sbAuth.findUserByEmail(adminEmail);
      if (u) {
        adminAccount = {
          email: adminEmail,
          exists: true,
          hasPassword: true,
          role: u.role,
        };
      }
    } catch {
      /* hub_accounts may not exist yet */
    }
  }

  return res.status(200).json({
    authReady,
    canSeedAdmin,
    dataProvider: provider,
    supabase,
    adminAccount,
    env,
    hints: {
      missingSessionSecret: !env.hasSessionSecret
        ? 'Add SESSION_SECRET in Vercel, then Redeploy.'
        : null,
      missingSupabase: !env.hasSupabaseUrl || !env.hasSupabaseServiceKey || !env.hasSupabaseAnonKey
        ? 'Add SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_ANON_KEY. See SUPABASE-FRESH-START.md.'
        : null,
      supabaseConnection: !supabase.ok && supabase.configured !== false ? supabase.message : null,
      setupAdminRequired: supabase.ok && !adminAccount.exists,
      nextStep: !supabase.ok
        ? 'Fix Supabase env vars in Vercel → Redeploy.'
        : !adminAccount.exists
          ? 'Run: node scripts/seed-admin.js (local) or POST /api/auth/setup-admin with ADMIN_SETUP_SECRET'
          : authReady
            ? 'Sign in at /login.html'
            : 'Complete env vars, then Redeploy',
    },
    checkUrl: '/api/auth/config-check',
  });
};
