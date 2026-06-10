const { sendTemplatedEmail } = require('./send-template-email');
const {
  siteBase,
  browseEventsUrl,
  hubAccountUrl,
  welcomeUrl,
  legalPolicyUrl,
  contactUrl,
} = require('./hub-email-urls');

function buildAccountWelcomeVars({ email, name, siteUrl }) {
  const site = siteBase(siteUrl);
  const displayName = String(name || '').trim() || 'there';
  const userEmail = String(email || '').trim().toLowerCase();

  return {
    user_name: displayName,
    user_email: userEmail,
    hub_account_url: hubAccountUrl(site),
    browse_events_url: browseEventsUrl(site),
    welcome_url: welcomeUrl(site),
    contact_url: contactUrl(site),
    privacy_url: legalPolicyUrl(site, 'privacy'),
    terms_url: legalPolicyUrl(site, 'terms'),
    refunds_url: legalPolicyUrl(site, 'refunds'),
    site_url: site,
    logo_url: site + '/assets/logo-nav.png',
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

module.exports = {
  buildAccountWelcomeVars,
  sendAccountWelcomeEmail,
};
