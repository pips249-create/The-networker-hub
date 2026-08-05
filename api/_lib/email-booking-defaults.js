const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { escapeHtml } = require('./event-refund-policy');
const {
  isEmailSponsorBlock,
  sponsorLogoUrl,
  sponsorCompanyName,
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

/** Soft neutral pad for logos — never use sponsor CTA colour (that looked like a blue button). */
const EMAIL_SPONSOR_LOGO_BAND_FALLBACK = '#ffffff';

function sponsorEmailLogoBandColor(block, override) {
  const fromOptions = String(override || '').trim();
  if (/^#[0-9a-f]{3,6}$/i.test(fromOptions)) return fromOptions.toLowerCase();
  // Ignore block.cta_color in emails — CTA colours are for website buttons, not logo pads.
  void block;
  return EMAIL_SPONSOR_LOGO_BAND_FALLBACK;
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
  const imgHtml =
    '<img src="' +
    safeLogo +
    '" alt="' +
    safeName +
    '" width="120" style="max-width:120px;width:auto;max-height:40px;height:auto;display:block;margin:0 auto;border:0;">';
  // No coloured CTA band — logo sits cleanly under the Powered by label.
  void logoBandBg;
  return imgHtml;
}

function buildSponsorSection(block, options) {
  if (!block) return '';
  const label = String(options?.label || '').trim() || 'Powered by';
  const logo = toPublicAssetUrl(sponsorLogoUrl(block), process.env.SITE_URL);
  const url = String(block.cta_url || '').trim();
  const name = sponsorCompanyName(block) || 'Our sponsor';
  if (!url) return '';
  const safeUrl = url.replace(/"/g, '&quot;');
  const logoHtml = buildSponsorLogoMarkup(logo, name);
  // Compact strip under the Hub logo — white so it sits cleanly under cream or purple headers.
  return (
    '<tr><td class="mobile-pad" style="padding:10px 40px 6px;text-align:center;background:#ffffff;">' +
    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;background:#ffffff;border-radius:10px;border:1px solid #e8e2e9;">' +
    '<tr><td style="padding:10px 22px 12px;text-align:center;vertical-align:middle;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:11px;font-weight:600;color:#8a8284;text-transform:uppercase;letter-spacing:1.2px;margin:0 0 6px;line-height:1;">' +
    label +
    '</p>' +
    '<a href="' +
    safeUrl +
    '" style="display:inline-block;text-decoration:none;line-height:0;">' +
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
