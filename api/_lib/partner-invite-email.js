/**
 * Partner programme invite email — branded hub invite + personalised links.
 */
const { sendTemplatedEmail } = require('./send-template-email');
const { emailSiteBase } = require('./hub-email-urls');
const { mapPartnerRow } = require('./affiliate-programme');
const { emailGreetingName } = require('./email-display-name');

function partnerInviteVariables(partner) {
  const mapped = mapPartnerRow(partner) || {};
  const site = emailSiteBase();
  const code = String(mapped.code || partner.code || '')
    .trim()
    .toUpperCase();
  const displayName = String(mapped.displayName || partner.display_name || code || 'there').trim();
  const firstName = emailGreetingName(displayName) || displayName.split(/\s+/)[0] || 'there';

  return {
    partner_code: code,
    partner_name: displayName,
    partner_first_name: firstName,
    home_url: mapped.linkHome || site + '/?ref=' + encodeURIComponent(code),
    ads_url: mapped.linkAdvertising || site + '/advertising?ref=' + encodeURIComponent(code),
    opp_url:
      mapped.linkOpportunityList || site + '/opportunities/list?ref=' + encodeURIComponent(code),
    hub_url:
      mapped.linkPartnerHub ||
      mapped.linkMediaKit ||
      site + '/partners/earnings?ref=' + encodeURIComponent(code),
    support_email: 'partnerships@thenetworkeruk.com',
  };
}

async function sendPartnerInviteEmail(partner) {
  const to = String(partner.email || '')
    .trim()
    .toLowerCase();
  if (!to) {
    const err = new Error('missing_partner_email');
    err.code = 'missing_partner_email';
    throw err;
  }

  const vars = partnerInviteVariables(partner);
  await sendTemplatedEmail({
    slug: 'partner_programme_invite',
    to,
    variables: vars,
    replyTo: 'partnerships@thenetworkeruk.com',
    resendTags: [
      { name: 'category', value: 'partner_programme_invite' },
      { name: 'partner_code', value: String(vars.partner_code || '').slice(0, 32) },
    ],
  });

  return { ok: true, to, code: vars.partner_code };
}

module.exports = {
  partnerInviteVariables,
  sendPartnerInviteEmail,
};
