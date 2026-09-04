/**
 * Industry Sponsor transactional emails — payment welcome.
 */
const { sendTemplatedEmail } = require('./send-template-email');
const { siteBase } = require('./hub-email-urls');
const { listIndustrySponsorCategories } = require('./opportunity-industry-sponsors');

function industryNamesForSlugs(slugs) {
  const bySlug = new Map(listIndustrySponsorCategories().map((r) => [r.slug, r.name]));
  return (slugs || [])
    .map((slug) => bySlug.get(slug) || slug)
    .filter(Boolean)
    .join(', ');
}

async function sendIndustrySponsorPaymentWelcome(opts) {
  const to = String(opts?.email || '').trim().toLowerCase();
  if (!to) return { skipped: true, reason: 'missing_email' };

  const industries = Array.isArray(opts?.industries) ? opts.industries : [];
  const industryNames = industryNamesForSlugs(industries);
  const siteUrl = siteBase();
  const creativeEmail = String(process.env.CITY_PARTNER_CREATIVE_EMAIL || 'rosie@thenetworkeruk.com')
    .trim()
    .toLowerCase();

  await sendTemplatedEmail({
    slug: 'industry_sponsor_payment_welcome',
    to,
    variables: {
      contact_name: to.split('@')[0] || 'there',
      industry_names: industryNames || 'your selected industries',
      advertising_url: siteUrl + '/advertising#industry-sponsor-package',
      creative_email: creativeEmail,
      monthly_note:
        'Your subscription renews monthly until cancelled. We publish your logo once creative is approved.',
      site_url: siteUrl,
    },
  });

  return { sent: true, to, industries };
}

module.exports = {
  sendIndustrySponsorPaymentWelcome,
  industryNamesForSlugs,
};
