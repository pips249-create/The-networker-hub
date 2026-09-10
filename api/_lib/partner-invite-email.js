/**
 * Partner programme invite email — media kit + personalised links.
 */
const { sendViaResend } = require('./send-template-email');
const { logoEmailHeaderUrl, emailSiteBase } = require('./hub-email-urls');
const { mapPartnerRow } = require('./affiliate-programme');

function escHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPartnerInviteHtml(partner) {
  const mapped = mapPartnerRow(partner) || {};
  const site = emailSiteBase();
  const logo = logoEmailHeaderUrl(site);
  const code = String(mapped.code || partner.code || '').trim().toUpperCase();
  const name = String(mapped.displayName || partner.display_name || code || 'there').trim();
  const ads = mapped.linkAdvertising || site + '/advertising?ref=' + encodeURIComponent(code);
  const opp =
    mapped.linkOpportunityList || site + '/opportunities/list?ref=' + encodeURIComponent(code);
  const kit = site + '/partners/kit?ref=' + encodeURIComponent(code);

  return (
    '<div style="font-family:DM Sans,Arial,sans-serif;line-height:1.55;color:#2d2636;max-width:560px;margin:0 auto;">' +
    '<div style="padding:20px 0 12px;text-align:left;">' +
    '<img src="' +
    escHtml(logo) +
    '" alt="The Networker UK" width="160" style="display:block;border:0;max-width:160px;height:auto;" />' +
    '</div>' +
    '<p style="margin:0 0 12px;">Hi ' +
    escHtml(name) +
    ',</p>' +
    '<p style="margin:0 0 12px;">You’re invited to The Networker UK <strong>Partner Programme</strong> — earn <strong>20%</strong> when you introduce brands who list a business opportunity or buy advertising / sponsorship with us.</p>' +
    '<p style="margin:0 0 8px;"><strong>Your code:</strong> ' +
    escHtml(code) +
    '</p>' +
    '<p style="margin:0 0 6px;"><strong>Advertising link</strong><br><a href="' +
    escHtml(ads) +
    '">' +
    escHtml(ads) +
    '</a></p>' +
    '<p style="margin:0 0 16px;"><strong>List an opportunity</strong><br><a href="' +
    escHtml(opp) +
    '">' +
    escHtml(opp) +
    '</a></p>' +
    '<p style="margin:0 0 18px;">' +
    '<a href="' +
    escHtml(kit) +
    '" style="display:inline-block;background:#1c2040;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:999px;">Open your media kit</a>' +
    '</p>' +
    '<p style="margin:0 0 12px;font-size:14px;color:#635c5e;">The media kit has official logos, suggested copy, and the rate card. Share your links only — buyers don’t need to type a code.</p>' +
    '<p style="margin:0;">Questions? Reply to this email or write to <a href="mailto:partnerships@thenetworkeruk.com">partnerships@thenetworkeruk.com</a>.</p>' +
    '<p style="margin:16px 0 0;">The Networker UK</p>' +
    '</div>'
  );
}

async function sendPartnerInviteEmail(partner) {
  const to = String(partner.email || '').trim().toLowerCase();
  if (!to) {
    const err = new Error('missing_partner_email');
    err.code = 'missing_partner_email';
    throw err;
  }

  const code = String(partner.code || '').trim().toUpperCase();
  await sendViaResend({
    to,
    subject: 'Your Networker UK partner kit · code ' + code,
    html: buildPartnerInviteHtml(partner),
    replyTo: 'partnerships@thenetworkeruk.com',
    skipAllowlist: true,
  });

  return { ok: true, to, code };
}

module.exports = {
  buildPartnerInviteHtml,
  sendPartnerInviteEmail,
};
