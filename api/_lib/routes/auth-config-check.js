const {
  airtableConfig,
  testAirtableConnection,
  findUserByEmail,
  cleanEnvVal,
} = require('../auth');
const {
  supabaseConfig,
  testSupabaseConnection,
  dataProvider,
  isSupabaseConfigured,
} = require('../supabase');

/**
 * Safe diagnostic: which auth env vars are set (never returns secret values).
 */
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { apiKey, baseId, usersTable } = airtableConfig();
  const sbCfg = supabaseConfig();
  const provider = dataProvider();

  const env = {
    hasSessionSecret: Boolean(process.env.SESSION_SECRET),
    hasAdminSetupSecret: Boolean(process.env.ADMIN_SETUP_SECRET),
    hasAdminEmail: Boolean(process.env.ADMIN_EMAIL),
    hasAdminInitialPassword: Boolean(process.env.ADMIN_INITIAL_PASSWORD),
    hasUsersTable: Boolean(usersTable),
    hasSiteUrl: Boolean(process.env.SITE_URL),
    hasAirtableApiKey: Boolean(apiKey),
    hasAirtableBaseId: Boolean(baseId),
    dataProvider: provider,
    hasSupabaseUrl: Boolean(sbCfg.url),
    hasSupabaseServiceKey: Boolean(sbCfg.serviceKey),
    hasSupabaseAnonKey: Boolean(sbCfg.anonKey),
  };

  const authReady =
    env.hasSessionSecret &&
    env.hasAdminSetupSecret &&
    env.hasAirtableApiKey &&
    env.hasAirtableBaseId &&
    env.hasUsersTable;

  const canSeedAdmin =
    authReady && (env.hasAdminInitialPassword || env.hasAdminEmail);

  const airtable = await testAirtableConnection();
  const supabase = isSupabaseConfigured() ? await testSupabaseConnection() : { ok: false, configured: false };

  const adminEmail = cleanEnvVal(process.env.ADMIN_EMAIL) || 'pips249@gmail.com';
  let adminAccount = { email: adminEmail, exists: false, hasPassword: false, role: null };
  if (airtable.ok) {
    try {
      const u = await findUserByEmail(adminEmail);
      if (u) {
        adminAccount = {
          email: adminEmail,
          exists: true,
          hasPassword: Boolean(u.passwordHash),
          role: u.role,
        };
      }
    } catch {
      /* Users table may be missing fields */
    }
  }

  return res.status(200).json({
    authReady,
    canSeedAdmin,
    dataProvider: provider,
    airtable,
    supabase,
    adminAccount,
    env,
    hints: {
      missingSessionSecret: !env.hasSessionSecret
        ? 'Add SESSION_SECRET in Vercel, then Redeploy.'
        : null,
      missingAdminSetupSecret: !env.hasAdminSetupSecret
        ? 'Add ADMIN_SETUP_SECRET in Vercel, then Redeploy.'
        : null,
      missingAirtableWrite: !env.hasAirtableApiKey
        ? 'Add AIRTABLE_API_KEY with read+write scopes.'
        : null,
      airtableAuth: !airtable.ok && airtable.error === 'AUTHENTICATION_REQUIRED'
        ? 'Airtable rejected your API key. Create a new pat token at airtable.com/create/tokens, paste into AIRTABLE_API_KEY (no quotes), Redeploy.'
        : !airtable.ok
          ? airtable.message
          : null,
      setupAdminRequired: airtable.ok && !adminAccount.exists,
      supabase:
        !env.hasSupabaseUrl || !env.hasSupabaseServiceKey
          ? 'Add SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in Vercel, redeploy. See SUPABASE-SETUP.md.'
          : !supabase.ok
            ? supabase.message
            : null,
      nextStep:
        provider === 'supabase' && supabase.ok
          ? 'Supabase connected. Next: add migration SQL to supabase/migrations/ and we migrate auth/events.'
          : airtable.ok && !adminAccount.exists
          ? 'Run POST /api/auth/setup-admin once (see VERCEL-AUTH-ENV.md Step 7), then sign in'
          : authReady && airtable.ok
        ? 'Sign in at /login.html — forgot password shows an on-page link (email not required)'
        : airtable.ok
          ? 'Complete env vars in Vercel → Deployments → Redeploy'
          : 'Fix AIRTABLE_API_KEY first (see airtableAuth hint), then Redeploy',
    },
    checkUrl: '/api/auth/config-check',
  });
};
