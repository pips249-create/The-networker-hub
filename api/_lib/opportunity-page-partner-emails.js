/**
 * Opportunity Page Partner welcome email after self-serve checkout.
 */
const { sendTemplatedEmail } = require('./send-template-email');
const { siteBase } = require('./hub-email-urls');

async function sendOpportunityPagePartnerPaymentWelcome(opts) {
  const to = String(opts?.email || '').trim().toLowerCase();
  if (!to) return { skipped: true, reason: 'missing_email' };

  const siteUrl = siteBase();
  const creativeEmail = String(process.env.CITY_PARTNER_CREATIVE_EMAIL || 'rosie@thenetworkeruk.com')
    .trim()
    .toLowerCase();

  await sendTemplatedEmail({
    slug: 'opportunity_page_partner_payment_welcome',
    to,
    variables: {
      contact_name: to.split('@')[0] || 'there',
      advertising_url: siteUrl + '/advertising#ad-pkg-opportunities-mini',
      creative_email: creativeEmail,
      monthly_note:
        'Your Page Partner slot is reserved. We publish your logo on opportunity pages and emails once creative is approved.',
      site_url: siteUrl,
    },
  });

  return { sent: true, to };
}

module.exports = {
  sendOpportunityPagePartnerPaymentWelcome,
};
