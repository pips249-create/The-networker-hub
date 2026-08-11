/**
 * Post-claim confirmation — founding badge + logo/website CTA.
 */
const { sendTemplatedEmail } = require('./send-template-email');
const { emailGreetingName } = require('./email-display-name');
const {
  siteBase,
  legalPolicyUrl,
  contactUrl,
  logoNavUrl,
  logoFooterUrl,
  supportEmail,
  organiserPublicUrl,
  organiserDashboardUrl,
  organiserGroupEditUrl,
} = require('./hub-email-urls');

const CLAIM_CONFIRMED_REPLY_TO = 'catherine@thenetworkerhub.com';

function foundingPerkRowHtml({ foundingHomepage }) {
  const homepageLine = foundingHomepage
    ? '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.78);margin:12px 0 0;">You\'re also in the first 50 for a homepage showcase through November.</p>'
    : '';
  return (
    '<tr><td class="mobile-pad" style="padding:0 40px 20px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#1c2040;border-radius:16px;">' +
    '<tr><td style="padding:22px 24px;text-align:center;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Founding perk</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:22px;font-weight:700;color:#ffffff;margin:0;letter-spacing:-0.02em;line-height:1.2;">Founding Organiser · 2026</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.78);margin:10px 0 0;">Your badge is live on your Hub page.</p>' +
    homepageLine +
    '</td></tr></table></td></tr>'
  );
}

function buildOrganiserClaimConfirmedVars({ group, session, siteUrl }) {
  const site = siteBase(siteUrl);
  const groupName = String(group?.name || 'Your organiser page').trim() || 'Your organiser page';
  const founding = Boolean(group?.foundingOrganiser || group?.founding_organiser_at);
  const foundingHomepage = Boolean(group?.foundingHomepage || group?.founding_homepage);
  const userName = emailGreetingName(session?.name || session?.email, 'there');

  return {
    user_name: userName,
    group_name: groupName,
    eyebrow_label: founding ? 'Founding Organiser' : 'Page claimed',
    hero_title: founding ? "You're in — badge unlocked" : 'Your organiser page is confirmed',
    intro_line: founding
      ? 'Thanks for confirming before launch. Your Founding Organiser · 2026 badge is on your Hub profile.'
      : 'Thanks for confirming. You can manage events, memberships, and your public page from the organiser workspace.',
    founding_perk_row: founding ? foundingPerkRowHtml({ foundingHomepage }) : '',
    profile_url: organiserPublicUrl(group, site),
    profile_edit_url: organiserGroupEditUrl(group, site, { onboard: 'review' }),
    dashboard_url: organiserDashboardUrl(site),
    site_url: site,
    logo_url: logoNavUrl(site),
    logo_footer_url: logoFooterUrl(site),
    privacy_url: legalPolicyUrl(site, 'privacy'),
    terms_url: legalPolicyUrl(site, 'terms'),
    refunds_url: legalPolicyUrl(site, 'refunds'),
    contact_url: contactUrl(site),
    support_email: supportEmail(),
  };
}

function claimConfirmedSubject(group) {
  const groupName = String(group?.name || 'Your organiser page').trim() || 'Your organiser page';
  if (group?.foundingOrganiser || group?.founding_organiser_at) {
    return "You're a Founding Organiser · 2026 — " + groupName;
  }
  return groupName + ' is claimed — finish your Hub page';
}

async function sendOrganiserClaimConfirmedEmail({ group, session, siteUrl }) {
  const to = String(session?.email || '')
    .trim()
    .toLowerCase();
  if (!to) return { ok: false, skipped: true, reason: 'missing_email' };
  if (!group?.id) return { ok: false, skipped: true, reason: 'missing_group' };

  const variables = buildOrganiserClaimConfirmedVars({ group, session, siteUrl });
  return sendTemplatedEmail({
    slug: 'organiser_claim_confirmed',
    to,
    variables,
    subject: claimConfirmedSubject(group),
    replyTo: CLAIM_CONFIRMED_REPLY_TO,
    resendTags: [
      { name: 'email_type', value: 'organiser_claim_confirmed' },
      { name: 'group_id', value: String(group.id).slice(0, 40) },
    ],
  });
}

module.exports = {
  CLAIM_CONFIRMED_REPLY_TO,
  buildOrganiserClaimConfirmedVars,
  claimConfirmedSubject,
  sendOrganiserClaimConfirmedEmail,
};
