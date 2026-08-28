const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { escapeHtml } = require('./event-refund-policy');
const {
  isEmailSponsorBlock,
  sponsorLogoUrl,
  sponsorCompanyName,
  sponsorLogoBandDark,
  hasSponsorLogo,
} = require('./cms-sponsor-fields');
const { toPublicAssetUrl } = require('./hub-email-urls');
const { withSponsorClickThrough } = require('./sponsor-utm');

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
/** Matches website sponsor-logo-band--dark so light logos stay visible in emails. */
const EMAIL_SPONSOR_LOGO_BAND_DARK = '#1a1a2e';

function isEmailSafeLogoUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return false;
  if (/^data:image\/svg/i.test(raw)) return false;
  if (/\.svg(?:[?#]|$)/i.test(raw)) return false;
  return /^(https?:|\/|data:image\/)/i.test(raw);
}

function sponsorEmailLogoBandColor(block, override) {
  const fromOptions = String(override || '').trim();
  if (/^#[0-9a-f]{3,6}$/i.test(fromOptions)) return fromOptions.toLowerCase();
  // Explicit CMS "use dark logo band" → dark.
  if (sponsorLogoBandDark(block)) return EMAIL_SPONSOR_LOGO_BAND_DARK;
  // Command Centre leaves this unchecked for many heroes; the website still auto-darkens
  // light logos on Events/Organisers/Opportunities browse. Emails cannot sample the image,
  // so default to the same dark pad — otherwise white logos vanish on the cream header.
  return EMAIL_SPONSOR_LOGO_BAND_DARK;
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
    '" width="140" style="max-width:140px;width:auto;max-height:48px;height:auto;display:block;margin:0 auto;border:0;">';
  const band = String(logoBandBg || '').trim().toLowerCase();
  if (band && band !== EMAIL_SPONSOR_LOGO_BAND_FALLBACK) {
    return (
      '<span style="display:inline-block;padding:12px 18px;background:' +
      band.replace(/"/g, '') +
      ';border-radius:8px;line-height:0;">' +
      imgHtml +
      '</span>'
    );
  }
  return imgHtml;
}

function buildSponsorSection(block, options) {
  if (!block) return '';
  const label = String(options?.label || '').trim() || 'Powered by';
  const rawLogo = sponsorLogoUrl(block);
  const hasLogo = hasSponsorLogo(block) && isEmailSafeLogoUrl(rawLogo);
  const name = sponsorCompanyName(block) || 'Our sponsor';
  if (!hasLogo && !sponsorCompanyName(block)) return '';
  const logo = hasLogo ? toPublicAssetUrl(rawLogo, process.env.SITE_URL) : '';
  const site = String(options?.siteUrl || process.env.SITE_URL || 'https://www.thenetworkeruk.com').replace(
    /\/$/,
    ''
  );
  const placement = String(options?.placement || options?.slot || 'email_sponsor').trim() || 'email_sponsor';
  const rawUrl = String(block.cta_url || '').trim() || site + '/advertising';
  // Route via Hub click-through so Brevo / email logo taps appear in sponsor packs.
  const url = withSponsorClickThrough(rawUrl, placement, {
    campaign: String(options?.campaign || placement).trim() || placement,
    company: name,
    siteUrl: site,
  });
  if (!url) return '';
  const safeUrl = url.replace(/"/g, '&quot;');
  const bandBg = sponsorEmailLogoBandColor(block, options?.logoBandBg);
  const logoHtml = buildSponsorLogoMarkup(logo, name, bandBg);
  // Sit on the cream header band by default — Email 2 moves this below the CTA on white.
  const sectionBg = String(options?.sectionBg || '#f5f0e8').trim() || '#f5f0e8';
  return (
    '<tr><td class="mobile-pad" style="padding:6px 40px 2px;text-align:center;background:' +
    sectionBg +
    ';">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:11px;font-weight:600;color:#8a8284;text-transform:uppercase;letter-spacing:1.2px;margin:0 0 8px;line-height:1;">' +
    label +
    '</p>' +
    '<a href="' +
    safeUrl +
    '" style="display:inline-block;text-decoration:none;line-height:0;">' +
    logoHtml +
    '</a></td></tr>'
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
    if (!data || !isEmailSponsorBlock(data)) continue;
    const raw = sponsorLogoUrl(data);
    if (!hasSponsorLogo(data) || !isEmailSafeLogoUrl(raw)) continue;
    return { block: data, slot };
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
  EMAIL_SPONSOR_LOGO_BAND_DARK,
  buildSponsorLogoMarkup,
  buildSponsorSection,
  getBookingEmailDefaultVars,
  resolveBookingEmailSponsorBlock,
  fetchSponsorBlockForSlot,
  sponsorEmailLogoBandColor,
  isEmailSafeLogoUrl,
};
