/**
 * Email 2 (organiser launch invite) sponsor — My Medical Cover.
 * Barnsgate declined; keep Brevo HTML and Resend/admin sends aligned.
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { fetchSponsorBlockForSlot } = require('./email-booking-defaults');
const { withSponsorClickThrough } = require('./sponsor-utm');
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

/** Quiet inline sponsor credit for Email 2 — no bordered card. */
function buildEmail2SponsorStripHtml({ site, logo, company, ctaUrl }) {
  const name = String(company || 'My Medical Cover').trim() || 'My Medical Cover';
  const logoSrc = String(logo || '').trim() || MMC_CDN_LOGO;
  const tracked = withSponsorClickThrough(ctaUrl || MMC_CTA, 'email2_launch', {
    campaign: 'email2_launch',
    company: name,
    siteUrl: site,
  });
  const safeUrl = String(tracked || MMC_CTA).replace(/"/g, '&quot;');
  const safeLogo = logoSrc.replace(/"/g, '&quot;');
  const safeName = name.replace(/"/g, '&quot;');

  return (
    '<tr>' +
    '<td class="mobile-pad" style="padding:8px 40px 20px;text-align:center;background:#ffffff;border-top:1px solid #eee9e4;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:11px;font-weight:600;color:#9a9496;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;line-height:1;">Supported by</p>' +
    '<a href="' +
    safeUrl +
    '" style="display:inline-block;text-decoration:none;line-height:0;">' +
    '<span style="display:inline-block;padding:8px 12px;background:#1a1a2e;border-radius:6px;line-height:0;">' +
    '<img src="' +
    safeLogo +
    '" alt="' +
    safeName +
    '" width="100" style="max-width:100px;width:auto;max-height:28px;height:auto;display:block;margin:0 auto;border:0;">' +
    '</span></a>' +
    '</td></tr>'
  );
}

/**
 * @param {object} [options]
 * @param {string} [options.siteUrl]
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
  const logo = hubPng || MMC_CDN_LOGO;

  const sponsorRow = buildEmail2SponsorStripHtml({
    site,
    logo,
    company,
    ctaUrl: cta,
  });

  return {
    sponsor_row: sponsorRow,
    sponsor_section: sponsorRow,
    mini_sponsors_row: '',
    tracked: [{ placement: 'email2_launch', company: 'My Medical Cover' }],
  };
}

/** Full <tr> strip for Brevo template fill. */
async function buildEmail2SponsorRowHtml(siteUrl) {
  const vars = await buildEmail2SponsorVars({ siteUrl });
  return vars.sponsor_row || '';
}

module.exports = {
  MMC_CTA,
  isMyMedicalCover,
  buildEmail2SponsorVars,
  buildEmail2SponsorRowHtml,
};
