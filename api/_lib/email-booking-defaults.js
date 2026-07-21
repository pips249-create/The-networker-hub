const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { escapeHtml } = require('./event-refund-policy');
const {
  isEmailSponsorBlock,
  sponsorLogoUrl,
  sponsorCompanyName,
  sponsorCtaColor,
} = require('./cms-sponsor-fields');
const { toPublicAssetUrl } = require('./hub-email-urls');

const BOOKING_EMAIL_SPONSOR_SLOT = 'booking_email_sponsor';
const EVENTS_SPONSOR_SLOT = 'events_sponsor_hub';
const LEGACY_SPONSOR_SLOT = 'sponsor_hub';
const SPONSOR_FALLBACK_SLOTS = [
  BOOKING_EMAIL_SPONSOR_SLOT,
  EVENTS_SPONSOR_SLOT,
  LEGACY_SPONSOR_SLOT,
];

/** Matches browse-page sponsor logo bands — avoids a harsh white pad behind logos. */
const EMAIL_SPONSOR_LOGO_BAND_FALLBACK = '#f3f4f6';

function sponsorEmailLogoBandColor(block, override) {
  const fromOptions = String(override || '').trim();
  if (/^#[0-9a-f]{3,6}$/i.test(fromOptions)) return fromOptions.toLowerCase();
  return sponsorCtaColor(block) || EMAIL_SPONSOR_LOGO_BAND_FALLBACK;
}

function buildSponsorLogoMarkup(logo, name, logoBandBg) {
  if (!logo) {
    return (
      '<span style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:600;color:#9a7aa8;">' +
      name +
      '</span>'
    );
  }
  const safeLogo = logo.replace(/"/g, '&quot;');
  const safeName = name.replace(/"/g, '&quot;');
  const safeBandBg = logoBandBg.replace(/"/g, '&quot;');
  const imgHtml =
    '<img src="' +
    safeLogo +
    '" alt="' +
    safeName +
    '" width="140" style="max-width:140px;width:100%;height:auto;display:block;margin:0 auto;">';
  return (
    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;background:' +
    safeBandBg +
    ';border-radius:10px;">' +
    '<tr><td style="padding:12px 24px;text-align:center;">' +
    imgHtml +
    '</td></tr></table>'
  );
}

function buildSponsorSection(block, options) {
  if (!block) return '';
  const label =
    String(options?.label || '').trim() ||
    'Sponsored — partner support helps keep The Networker Hub free';
  const logo = toPublicAssetUrl(sponsorLogoUrl(block), process.env.SITE_URL);
  const url = String(block.cta_url || '').trim();
  const name = sponsorCompanyName(block) || 'Our sponsor';
  if (!url) return '';
  const safeUrl = url.replace(/"/g, '&quot;');
  const logoBandBg = sponsorEmailLogoBandColor(block, options?.logoBandBg);
  const logoHtml = buildSponsorLogoMarkup(logo, name, logoBandBg);
  // Sits in the cream logo-hero band, in a bordered container just below the Hub logo.
  return (
    '<tr><td class="mobile-pad" style="padding:12px 40px 10px;text-align:center;background:#f5f0e8;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f0e8;border-radius:14px;border:1px solid #d9c4e0;">' +
    '<tr><td style="padding:16px 20px;text-align:center;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:600;color:#7a7274;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">' +
    label +
    '</p>' +
    '<a href="' +
    safeUrl +
    '" style="display:inline-block;text-decoration:none;">' +
    logoHtml +
    '</a></td></tr></table></td></tr>'
  );
}

async function fetchSponsorBlockForSlot(sb, slot) {
  const { data, error } = await sb.from('cms_blocks').select('*').eq('slot', slot).maybeSingle();
  if (error) throw error;
  return data;
}

async function resolveBookingEmailSponsorBlock(sb) {
  for (const slot of SPONSOR_FALLBACK_SLOTS) {
    const data = await fetchSponsorBlockForSlot(sb, slot);
    if (data && isEmailSponsorBlock(data)) return { block: data, slot };
  }
  return { block: null, slot: '' };
}

async function getBookingEmailDefaultVars() {
  if (!isSupabaseConfigured()) return { sponsor_section: '' };
  try {
    const sb = getSupabaseAdmin();
    const { block } = await resolveBookingEmailSponsorBlock(sb);
    if (!block) return { sponsor_section: '' };
    return { sponsor_section: buildSponsorSection(block) };
  } catch {
    return { sponsor_section: '' };
  }
}

module.exports = {
  BOOKING_EMAIL_SPONSOR_SLOT,
  EVENTS_SPONSOR_SLOT,
  EMAIL_SPONSOR_LOGO_BAND_FALLBACK,
  buildSponsorLogoMarkup,
  buildSponsorSection,
  getBookingEmailDefaultVars,
  resolveBookingEmailSponsorBlock,
  fetchSponsorBlockForSlot,
  sponsorEmailLogoBandColor,
};
