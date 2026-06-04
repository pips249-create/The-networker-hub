const { airtableConfig } = require('../lib/auth');

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

  const env = {
    hasSessionSecret: Boolean(process.env.SESSION_SECRET),
    hasAdminSetupSecret: Boolean(process.env.ADMIN_SETUP_SECRET),
    hasAdminEmail: Boolean(process.env.ADMIN_EMAIL),
    hasAdminInitialPassword: Boolean(process.env.ADMIN_INITIAL_PASSWORD),
    hasUsersTable: Boolean(usersTable),
    hasSiteUrl: Boolean(process.env.SITE_URL),
    hasAirtableApiKey: Boolean(apiKey),
    hasAirtableBaseId: Boolean(baseId),
  };

  const authReady =
    env.hasSessionSecret &&
    env.hasAdminSetupSecret &&
    env.hasAirtableApiKey &&
    env.hasAirtableBaseId &&
    env.hasUsersTable;

  const canSeedAdmin =
    authReady && (env.hasAdminInitialPassword || env.hasAdminEmail);

  return res.status(200).json({
    authReady,
    canSeedAdmin,
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
      nextStep: authReady
        ? 'POST /api/auth/setup-admin once, then sign in at /login.html'
        : 'Complete env vars in Vercel → Deployments → Redeploy',
    },
    checkUrl: '/api/auth/config-check',
  });
};
