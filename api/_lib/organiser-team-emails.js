const { sendTemplatedEmail } = require('./send-template-email');
const {
  siteBase,
  homeUrl,
  organiserDashboardUrl,
  logoNavUrl,
  logoFooterUrl,
  legalPolicyUrl,
  contactUrl,
} = require('./hub-email-urls');

function teamInviteAcceptUrl(siteUrl, inviteeEmail) {
  const site = siteBase(siteUrl);
  const next = encodeURIComponent('/organiser/index.html');
  const email = encodeURIComponent(String(inviteeEmail || '').trim().toLowerCase());
  return site + '/login.html?next=' + next + '&email=' + email;
}

async function sendOrganiserTeamInviteEmail({
  to,
  inviterName,
  accountName,
  siteUrl,
}) {
  const site = siteBase(siteUrl);
  const recipient = String(to || '')
    .trim()
    .toLowerCase();
  return sendTemplatedEmail({
    slug: 'organiser_team_invite',
    to: recipient,
    variables: {
      inviter_name: String(inviterName || 'Your organiser').trim() || 'Your organiser',
      account_name: String(accountName || 'your organiser account').trim() || 'your organiser account',
      accept_url: teamInviteAcceptUrl(site, recipient),
      workspace_url: organiserDashboardUrl(site),
      site_url: homeUrl(site),
      logo_url: logoNavUrl(site),
      logo_footer_url: logoFooterUrl(site),
      privacy_url: legalPolicyUrl(site, 'privacy'),
      terms_url: legalPolicyUrl(site, 'terms'),
      contact_url: contactUrl(site),
    },
  });
}

module.exports = {
  teamInviteAcceptUrl,
  sendOrganiserTeamInviteEmail,
};
