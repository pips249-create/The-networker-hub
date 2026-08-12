/**
 * Email 2 (organiser launch invite) sponsor — My Medical Cover.
 * Barnsgate declined; keep Brevo HTML and Resend/admin sends aligned.
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { buildSponsorSection, fetchSponsorBlockForSlot } = require('./email-booking-defaults');
const { sponsorCompanyName } = require('./cms-sponsor-fields');
const { emailSiteBase, toPublicAssetUrl } = require('./hub-email-urls');

const MMC_CTA = 'https://my-mc.co.uk/';
const MMC_CDN_LOGO = 'https://my-mc.co.uk/wp-content/uploads/2021/05/logo_white.png';

function isMyMedicalCover(name) {
  return /medical\s*cover/i.test(String(name || ''));
}

async function resolveEmail2SponsorBlock(sb) {
  if (!sb) return null;
  const slots = ['booking_email_sponsor', 'events_sponsor_hub', 'opportunities_sponsor_hub'];
  for (const slot of slots) {
    try {
      const block = await fetchSponsorBlockForSlot(sb, slot);
      if (block && isMyMedicalCover(sponsorCompanyName(block))) return block;
    } catch {
      /* try next */
    }
  }
  // Prefer booking/events creative even if the company name drifted — Email 2 always shows MMC.
  try {
    return (
      (await fetchSponsorBlockForSlot(sb, 'booking_email_sponsor')) ||
      (await fetchSponsorBlockForSlot(sb, 'events_sponsor_hub')) ||
      null
    );
  } catch {
    return null;
  }
}

/**
 * @param {object} [options]
 * @param {string} [options.siteUrl]
 * @param {boolean} [options.wrapRow] wrap in the standard email <tr> sponsor band
 */
async function buildEmail2SponsorVars(options = {}) {
  const site = emailSiteBase(options.siteUrl);
  const hubPng = toPublicAssetUrl('/assets/sponsors/my-medical-cover-logo-white.png', site);
  let sb = null;
  if (isSupabaseConfigured()) {
    try {
      sb = getSupabaseAdmin();
    } catch {
      sb = null;
    }
  }

  const block = sb ? await resolveEmail2SponsorBlock(sb) : null;
  const company = isMyMedicalCover(sponsorCompanyName(block))
    ? sponsorCompanyName(block)
    : 'My Medical Cover';
  const cta = String((block && block.cta_url) || MMC_CTA).trim() || MMC_CTA;
  const emailBlock = {
    ...(block || {}),
    company_name: company,
    logo_url: hubPng || MMC_CDN_LOGO,
    image_url: hubPng || MMC_CDN_LOGO,
    cta_url: cta,
    active: true,
  };

  const inner = buildSponsorSection(emailBlock, {
    label: 'Powered by',
    placement: 'email2_launch',
    campaign: 'email2_launch',
    logoBandBg: '#1a1a2e',
    siteUrl: site,
    // Email 2 places the sponsor under the CTA on the white body, not the cream header.
    sectionBg: '#ffffff',
  });

  if (!inner) {
    return { sponsor_row: '', sponsor_section: '', mini_sponsors_row: '', tracked: [] };
  }

  const sponsorRow =
    options.wrapRow === false
      ? inner
      : /^<tr[\s>]/i.test(inner)
        ? inner
        : '<tr><td class="mobile-pad" style="padding:6px 40px 2px;text-align:center;background:#f5f0e8;">' +
          inner +
          '</td></tr>';

  return {
    sponsor_row: sponsorRow,
    sponsor_section: sponsorRow,
    mini_sponsors_row: '',
    tracked: [{ placement: 'email2_launch', company: 'My Medical Cover' }],
  };
}

/** Inner HTML only (no wrapping <tr>) — for Brevo template fill. */
async function buildEmail2SponsorRowHtml(siteUrl) {
  const vars = await buildEmail2SponsorVars({ siteUrl, wrapRow: false });
  return vars.sponsor_row || '';
}

module.exports = {
  MMC_CTA,
  isMyMedicalCover,
  buildEmail2SponsorVars,
  buildEmail2SponsorRowHtml,
};
