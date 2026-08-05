/**
 * Shared defaults for organiser bulk campaigns (Email 1 rebrand + Email 2 confirm).
 */
const LEGACY_SITE_URL = 'https://the-networker.co.uk';
const LEGACY_REPLY_EMAIL = 'hello@the-networker.co.uk';
const DEFAULT_LEGACY_FROM = 'Rosie @ The Networker <hello@the-networker.co.uk>';

function campaignSiteVars(host) {
  const site = String(host || '').replace(/\/$/, '');
  return {
    site_url: site,
    legacy_site_url: LEGACY_SITE_URL,
    legacy_logo_url: site + '/assets/logo-networker-legacy.png',
    logo_footer_url: site + '/assets/logo-email-footer.png',
    for_organisers_url: site + '/for-organisers',
    company_name: 'The Networker Group Ltd',
    company_number: '15252227',
    legacy_email: LEGACY_REPLY_EMAIL,
  };
}

function legacyCampaignFrom() {
  return (
    String(process.env.RESEND_FROM_LEGACY || '').trim() ||
    String(process.env.RESEND_FROM_THE_NETWORKER || '').trim() ||
    DEFAULT_LEGACY_FROM
  );
}

function isRebrandCampaignSlug(slug) {
  return String(slug || '').trim() === 'organiser_rebrand_announcement';
}

module.exports = {
  LEGACY_SITE_URL,
  LEGACY_REPLY_EMAIL,
  DEFAULT_LEGACY_FROM,
  campaignSiteVars,
  legacyCampaignFrom,
  isRebrandCampaignSlug,
};
