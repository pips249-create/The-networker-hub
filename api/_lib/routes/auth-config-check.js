const { cleanEnvVal, sessionFromRequest, requireAdmin, json } = require('../auth');
const { timingSafeEqualString } = require('../crypto-utils');
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
const { siteAccessStatus } = require('../site-access');

/**
 * Safe diagnostic: which env vars are set (never returns secret values).
 * Supabase-only — Airtable is optional legacy.
 *
 * Production: admin session or Authorization: Bearer <CONFIG_CHECK_SECRET> required.
 */
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const isProduction = process.env.VERCEL_ENV === 'production';
  if (isProduction) {
    const session = sessionFromRequest(req);
    const adminGate = requireAdmin(session);
    const checkSecret = String(process.env.CONFIG_CHECK_SECRET || '').trim();
    const authHeader = String(req.headers.authorization || '').trim();
    const bearerOk =
      checkSecret && timingSafeEqualString(authHeader, 'Bearer ' + checkSecret);

    if (!adminGate.ok && !bearerOk) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Config check requires an admin session or CONFIG_CHECK_SECRET bearer token in production.',
      });
    }
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  const sbCfg = supabaseConfig();
  const provider = dataProvider();

  const env = {
    hasSessionSecret: Boolean(process.env.SESSION_SECRET),
    hasAdminEmail: Boolean(process.env.ADMIN_EMAIL),
    hasAdminInitialPassword: Boolean(process.env.ADMIN_INITIAL_PASSWORD),
    hasAdminSetupSecret: Boolean(process.env.ADMIN_SETUP_SECRET),
    hasConfigCheckSecret: Boolean(String(process.env.CONFIG_CHECK_SECRET || '').trim()),
    hasSiteUrl: Boolean(process.env.SITE_URL),
      hasSiteAccessPassword: Boolean(String(process.env.SITE_ACCESS_PASSWORD || '').trim()),
      hasBannerPeekToken: Boolean(String(process.env.SITE_ACCESS_BANNER_TOKEN || '').trim()),
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
  const siteAccess = siteAccessStatus();

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
    siteAccess,
    env: {
      ...env,
      hasResendApiKey: email.hasResendApiKey,
      hasResendFrom: email.hasResendFrom,
      hasResendWebhookSecret: email.hasResendWebhookSecret,
      hasCronSecret: cron.hasCronSecret,
      isProduction: cron.isProduction,
      emailSendingConfigured: email.emailSendingConfigured,
      emailAllowlistEnabled: email.emailAllowlistEnabled,
      emailAllowlistCount: email.emailAllowlistCount,
      automatedEmailSequencesEnabled: email.automatedEmailSequencesEnabled,
      automatedEmailSequencesResumesAt: email.automatedEmailSequencesResumesAt,
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
      removeSetupSecret:
        env.hasAdminSetupSecret && adminAccount.exists
          ? 'Admin exists — remove ADMIN_SETUP_SECRET from Vercel Production env vars.'
          : null,
      configCheckProduction:
        cron.isProduction && !env.hasConfigCheckSecret
          ? 'Config check is admin-only in production. Optionally set CONFIG_CHECK_SECRET for scripted health probes (Authorization: Bearer …).'
          : null,
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
      checkoutWebhookReady:
        stripe.checkoutReady
          ? 'Stripe checkout + webhook env vars are set. Run one test purchase on production to confirm webhook → registration row in Supabase (email optional until Resend domain is verified).'
          : null,
      checkoutEmailReady:
        stripe.checkoutReady && email.emailSendingConfigured
          ? 'Resend is configured — confirmation emails will send after checkout once the domain is verified.'
          : null,
      emailAllowlist:
        email.emailAllowlistEnabled
          ? `Email allowlist is ON (${email.emailAllowlistCount} addresses). Only whitelisted recipients receive mail. Unset EMAIL_ALLOWLIST_ENABLED (or set EMAIL_ALLOWLIST_DISABLED=true) to send to everyone.`
          : null,
      automatedEmailSequences:
        email.automatedEmailSequencesPaused
          ? `Automated email sequences are PAUSED until ${email.automatedEmailSequencesResumesAt}. Nurture/digest crons skip; booking confirmations and auth mail still send. Set AUTOMATED_EMAIL_SEQUENCES_FORCE_ON=true to resume early.`
          : null,
      siteAccessGate:
        siteAccess.siteAccessRequired && !siteAccess.siteAccessReady
          ? 'SITE_ACCESS_PASSWORD is set but empty — the gate cannot issue access cookies until a password value is configured.'
          : siteAccess.siteAccessRequired
            ? 'Site access gate is ON. Public visitors only see /site-access (waitlist). The full site needs the preview password cookie. Remove SITE_ACCESS_PASSWORD when you open browsing. Tickets and enquiries stay closed until 1 September.'
            : null,
      nextStep: !supabase.ok
        ? 'Fix Supabase env vars in Vercel → Redeploy.'
        : !adminAccount.exists
          ? 'Run: node scripts/seed-admin.js (local) or POST /api/auth/setup-admin with ADMIN_SETUP_SECRET'
          : authReady
            ? 'Sign in at /login'
            : 'Complete env vars, then Redeploy',
    },
    checkUrl: '/api/auth/config-check',
  });
};
