/**
 * City Partner transactional emails — payment welcome and waitlist notifications.
 */
const { sendTemplatedEmail } = require('./send-template-email');
const { siteBase, supportEmail } = require('./hub-email-urls');
const { listCityPartnerRegions } = require('./networking-city-partners');
const { formatAvailableFromLabel } = require('./city-partner-waitlist');

function cityNamesForSlugs(slugs) {
  const bySlug = new Map(listCityPartnerRegions().map((r) => [r.slug, r.name]));
  return (slugs || [])
    .map((slug) => bySlug.get(slug) || slug)
    .filter(Boolean)
    .join(', ');
}

async function sendCityPartnerPaymentWelcome(opts) {
  const to = String(opts?.email || '').trim().toLowerCase();
  if (!to) return { skipped: true, reason: 'missing_email' };

  const cities = Array.isArray(opts?.cities) ? opts.cities : [];
  const cityNames = cityNamesForSlugs(cities);
  const siteUrl = siteBase();
  const creativeEmail = String(process.env.CITY_PARTNER_CREATIVE_EMAIL || 'rosie@thenetworkeruk.com')
    .trim()
    .toLowerCase();

  await sendTemplatedEmail({
    slug: 'city_partner_payment_welcome',
    to,
    variables: {
      contact_name: to.split('@')[0] || 'there',
      city_names: cityNames || 'your selected cities',
      advertising_url: siteUrl + '/advertising#city-partner-package',
      creative_email: creativeEmail,
      monthly_note:
        'Your subscription renews monthly until cancelled. We publish your logo once creative is approved.',
      site_url: siteUrl,
    },
  });

  return { sent: true, to, cities };
}

module.exports = {
  sendCityPartnerPaymentWelcome,
  cityNamesForSlugs,
};
