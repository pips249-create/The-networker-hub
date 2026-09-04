/**
 * County Partner transactional emails — payment welcome.
 */
const { sendTemplatedEmail } = require('./send-template-email');
const { siteBase } = require('./hub-email-urls');
const { listCountyPartnerRegions } = require('./networking-county-partners');

function countyNamesForSlugs(slugs) {
  const bySlug = new Map(listCountyPartnerRegions().map((r) => [r.slug, r.name]));
  return (slugs || [])
    .map((slug) => bySlug.get(slug) || slug)
    .filter(Boolean)
    .join(', ');
}

async function sendCountyPartnerPaymentWelcome(opts) {
  const to = String(opts?.email || '').trim().toLowerCase();
  if (!to) return { skipped: true, reason: 'missing_email' };

  const counties = Array.isArray(opts?.counties) ? opts.counties : [];
  const countyNames = countyNamesForSlugs(counties);
  const siteUrl = siteBase();
  const creativeEmail = String(process.env.CITY_PARTNER_CREATIVE_EMAIL || 'rosie@thenetworkeruk.com')
    .trim()
    .toLowerCase();

  await sendTemplatedEmail({
    slug: 'county_partner_payment_welcome',
    to,
    variables: {
      contact_name: to.split('@')[0] || 'there',
      county_names: countyNames || 'your selected counties',
      advertising_url: siteUrl + '/advertising#county-partner-package',
      creative_email: creativeEmail,
      monthly_note:
        'Your subscription renews monthly until cancelled. We publish your logo once creative is approved.',
      site_url: siteUrl,
    },
  });

  return { sent: true, to, counties };
}

module.exports = {
  sendCountyPartnerPaymentWelcome,
  countyNamesForSlugs,
};
