const { cleanEnvVal } = require('../auth');
const {
  supabaseConfig,
  testSupabaseConnection,
  dataProvider,
  isSupabaseConfigured,
} = require('../supabase');
const sbAuth = require('../supabase-auth');
const { emailConfigStatus } = require('../email-config');
const { cronConfigStatus } = require('../cron-auth');
const { stripeConfigStatus } = require('../stripe-config');

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
  const email = emailConfigStatus();
  const cron = cronConfigStatus();
  const stripe = stripeConfigStatus();

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
    email,
    cron,
    stripe,
    env: {
      ...env,
      hasResendApiKey: email.hasResendApiKey,
      hasResendFrom: email.hasResendFrom,
      hasCronSecret: cron.hasCronSecret,
      isProduction: cron.isProduction,
      emailSendingConfigured: email.emailSendingConfigured,
      cronReady: cron.cronReady,
      hasStripeSecretKey: stripe.hasStripeSecretKey,
      hasStripeWebhookSecret: stripe.hasStripeWebhookSecret,
      stripeConnectEnabled: stripe.stripeConnectEnabled,
      stripeMode: stripe.stripeMode,
      checkoutReady: stripe.checkoutReady,
    },
    hints: {
      missingSessionSecret: !env.hasSessionSecret
        ? 'Add SESSION_SECRET in Vercel, then Redeploy.'
        : null,
      missingSupabase: !env.hasSupabaseUrl || !env.hasSupabaseServiceKey || !env.hasSupabaseAnonKey
        ? 'Add SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_ANON_KEY. See SUPABASE-FRESH-START.md.'
        : null,
      supabaseConnection: !supabase.ok && supabase.configured !== false ? supabase.message : null,
      setupAdminRequired: supabase.ok && !adminAccount.exists,
      missingResend:
        !email.emailSendingConfigured
          ? 'Add RESEND_API_KEY and RESEND_FROM in Vercel (and local.env for localhost test sends), then redeploy.'
          : null,
      missingCronSecret:
        cron.isProduction && !cron.hasCronSecret
          ? 'Add CRON_SECRET in Vercel Production env vars. Vercel Cron sends Authorization: Bearer <CRON_SECRET> automatically.'
          : null,
      missingStripeSecret: !stripe.hasStripeSecretKey
        ? 'Add STRIPE_SECRET_KEY (sk_test_… or sk_live_…) in Vercel → Environment Variables, then redeploy.'
        : null,
      missingStripeWebhook:
        stripe.hasStripeSecretKey && !stripe.hasStripeWebhookSecret
          ? 'Add STRIPE_WEBHOOK_SECRET from Stripe Dashboard → Developers → Webhooks → your endpoint signing secret, then redeploy.'
          : null,
      stripeModeMismatch:
        stripe.stripeMode === 'test' && cron.isProduction
          ? 'STRIPE_SECRET_KEY is test mode (sk_test_…). Use sk_live_… for real production payments, or keep test for a dry run.'
          : null,
      checkoutGateReady:
        stripe.checkoutReady && email.emailSendingConfigured
          ? 'Checkout + email env vars are set. Run one test purchase on production to confirm webhook → registration → confirmation email.'
          : null,
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
