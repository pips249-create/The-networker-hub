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

/** Compact sponsor strip for Email 2 body (under CTAs) — quieter than the header band. */
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
    '<td class="mobile-pad" style="padding:20px 40px 8px;text-align:center;background:#ffffff;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:280px;margin:0 auto;border:1px solid #e8e4e0;border-radius:12px;background:#f7f5f2;">' +
    '<tr>' +
    '<td style="padding:14px 16px;text-align:center;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:10px;font-weight:600;color:#8a8486;text-transform:uppercase;letter-spacing:1.1px;margin:0 0 10px;line-height:1;">Supported by</p>' +
    '<a href="' +
    safeUrl +
    '" style="display:inline-block;text-decoration:none;line-height:0;">' +
    '<span style="display:inline-block;padding:10px 14px;background:#1a1a2e;border-radius:8px;line-height:0;">' +
    '<img src="' +
    safeLogo +
    '" alt="' +
    safeName +
    '" width="120" style="max-width:120px;width:auto;max-height:36px;height:auto;display:block;margin:0 auto;border:0;">' +
    '</span></a>' +
    '</td></tr></table>' +
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
