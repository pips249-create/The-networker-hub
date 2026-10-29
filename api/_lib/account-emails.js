const { sendTemplatedEmail } = require('./send-template-email');
const { emailGreetingName } = require('./email-display-name');
const { getSupabaseAdmin } = require('./supabase');
const {
  siteBase,
  browseEventsUrl,
  opportunitiesBrowseUrl,
  hubAccountUrl,
  hubClaimAttendedUrl,
  welcomeUrl,
  legalPolicyUrl,
  contactUrl,
  logoNavUrl,
  logoFooterUrl,
  supportEmail,
} = require('./hub-email-urls');

/** Auth user_metadata key — welcome after confirm, not on create-account. */
const ACCOUNT_WELCOME_POLICY_KEY = 'account_welcome_policy';
const ACCOUNT_WELCOME_AFTER_VERIFY = 'after_verify';
const ACCOUNT_WELCOME_SKIP = 'skip';
const ACCOUNT_WELCOME_SENT = 'sent';

function buildAccountWelcomeVars({ email, name, siteUrl }) {
  const site = siteBase(siteUrl);
  const displayName = emailGreetingName(name, 'there');
  const userEmail = String(email || '').trim().toLowerCase();

  return {
    user_name: displayName,
    user_email: userEmail,
    hub_account_url: hubAccountUrl(site),
    claim_attended_url: hubClaimAttendedUrl(site),
    browse_events_url: browseEventsUrl(site),
    opportunities_url: opportunitiesBrowseUrl(site),
    welcome_url: welcomeUrl(site),
    contact_url: contactUrl(site),
    privacy_url: legalPolicyUrl(site, 'privacy'),
    terms_url: legalPolicyUrl(site, 'terms'),
    refunds_url: legalPolicyUrl(site, 'refunds'),
    site_url: site,
    logo_url: logoNavUrl(site),
    logo_footer_url: logoFooterUrl(site),
    support_email: supportEmail(),
  };
}

async function sendAccountWelcomeEmail({ email, name, siteUrl }) {
  const to = String(email || '').trim().toLowerCase();
  if (!to) return { ok: false, skipped: true, reason: 'missing_email' };

  const variables = buildAccountWelcomeVars({ email: to, name, siteUrl });
  return sendTemplatedEmail({
    slug: 'account_welcome',
    to,
    variables,
  });
}

async function setAccountWelcomePolicy(userId, policy) {
  const uid = String(userId || '').trim();
  const value = String(policy || '').trim();
  if (!uid || !value) return { ok: false, skipped: true, reason: 'missing_args' };

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.auth.admin.getUserById(uid);
  if (error || !data?.user) {
    return { ok: false, skipped: true, reason: 'user_not_found' };
  }

  const user_metadata = {
    ...(data.user.user_metadata || {}),
    [ACCOUNT_WELCOME_POLICY_KEY]: value,
  };
  const { error: updateError } = await sb.auth.admin.updateUserById(uid, { user_metadata });
  if (updateError) throw new Error(updateError.message);
  return { ok: true, policy: value };
}

/**
 * After a successful inbox code submit, send account_welcome once.
 * Claim signups store "skip" and never get the generic welcome.
 * Register must never send welcome — only this path may.
 * Requires hub.organiser_email_verified_at so welcome cannot race ahead of confirm.
 * Unset policy (failed metadata write) still sends once after a real confirm.
 */
async function maybeSendDeferredAccountWelcome({ userId, email, name, siteUrl }) {
  const uid = String(userId || '').trim();
  if (!uid) return { ok: false, skipped: true, reason: 'missing_user' };

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.auth.admin.getUserById(uid);
  if (error || !data?.user) {
    return { ok: false, skipped: true, reason: 'user_not_found' };
  }

  const policy = String(data.user.user_metadata?.[ACCOUNT_WELCOME_POLICY_KEY] || '').trim();
  if (policy === ACCOUNT_WELCOME_SKIP || policy === ACCOUNT_WELCOME_SENT) {
    return { ok: false, skipped: true, reason: policy };
  }

  const { data: hub, error: hubError } = await sb
    .from('hub_accounts')
    .select('organiser_email_verified_at')
    .eq('user_id', uid)
    .maybeSingle();
  if (hubError) {
    return { ok: false, skipped: true, reason: 'hub_lookup_failed' };
  }
  if (!hub?.organiser_email_verified_at) {
    return { ok: false, skipped: true, reason: 'email_not_verified' };
  }

  const result = await sendAccountWelcomeEmail({ email, name, siteUrl });
  try {
    const user_metadata = {
      ...(data.user.user_metadata || {}),
      [ACCOUNT_WELCOME_POLICY_KEY]: ACCOUNT_WELCOME_SENT,
    };
    await sb.auth.admin.updateUserById(uid, { user_metadata });
  } catch {
    /* Welcome already sent; policy update is best-effort */
  }
  return result;
}

module.exports = {
  ACCOUNT_WELCOME_AFTER_VERIFY,
  ACCOUNT_WELCOME_SKIP,
  ACCOUNT_WELCOME_SENT,
  buildAccountWelcomeVars,
  sendAccountWelcomeEmail,
  setAccountWelcomePolicy,
  maybeSendDeferredAccountWelcome,
};
