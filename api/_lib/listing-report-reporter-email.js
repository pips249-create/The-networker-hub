const { sendTemplatedEmail } = require('./send-template-email');
const { siteBase, legalPolicyUrl, contactUrl, logoNavUrl, logoFooterUrl } = require('./hub-email-urls');

function reporterNameFromEmail(email) {
  const local = String(email || '')
    .trim()
    .split('@')[0]
    .replace(/[._+-]+/g, ' ')
    .trim();
  if (!local) return 'there';
  return local.charAt(0).toUpperCase() + local.slice(1);
}

async function sendListingReportUpholdReporterEmail({ to, listingTitle }) {
  const recipient = String(to || '').trim().toLowerCase();
  if (!recipient) return { skipped: true, reason: 'missing_reporter_email' };

  const siteUrl = siteBase();
  await sendTemplatedEmail({
    slug: 'listing_report_upheld_reporter',
    to: recipient,
    variables: {
      reporter_name: reporterNameFromEmail(recipient),
      listing_title: String(listingTitle || 'the listing').trim() || 'the listing',
      site_url: siteUrl,
      logo_url: logoNavUrl(siteUrl),
      logo_footer_url: logoFooterUrl(siteUrl),
      privacy_url: legalPolicyUrl(siteUrl, 'privacy'),
      terms_url: legalPolicyUrl(siteUrl, 'terms'),
      contact_url: contactUrl(siteUrl),
    },
  });
  return { sent: true, to: recipient };
}

module.exports = {
  sendListingReportUpholdReporterEmail,
};
