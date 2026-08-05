/**
 * Sponsor Hub CMS block — normalize read/write across schema variants.
 * Production may use subtitle/image_url; newer code uses title/logo_url/company_name.
 */

function sponsorTagline(block) {
  if (!block) return '';
  const title = String(block.title || '').trim();
  if (title && title.toLowerCase() !== 'sponsor hub' && title.toLowerCase() !== 'powered by') return title;
  const subtitle = String(block.subtitle || '').trim();
  if (subtitle) return subtitle;
  const body = String(block.body || '');
  const h3Match = body.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
  if (h3Match) {
    return h3Match[1].replace(/<[^>]+>/g, '').trim();
  }
  return '';
}

function sponsorLogoUrl(block) {
  if (!block) return '';
  return String(block.logo_url || block.image_url || '').trim();
}

function sponsorCompanyName(block) {
  if (!block) return '';
  return String(block.company_name || '').trim();
}

const DEFAULT_CTA_COLOR = '#2d2636';

function sanitizeCtaColor(color) {
  const c = String(color || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(c)) {
    return (
      '#' +
      c[1] +
      c[1] +
      c[2] +
      c[2] +
      c[3] +
      c[3]
    ).toLowerCase();
  }
  return '';
}

function sponsorCtaColor(block) {
  if (!block) return '';
  return sanitizeCtaColor(block.cta_color);
}

function hasSponsorLogo(block) {
  const url = sponsorLogoUrl(block);
  return /^(https?:|\/|data:image\/)/i.test(url);
}

function hasValidCtaUrl(url) {
  const u = String(url || '').trim();
  if (!u) return false;
  if (/^mailto:/i.test(u)) return u.length > 7;
  if (/^https?:\/\//i.test(u)) return u.replace(/^https?:\/\//i, '').trim().length > 0;
  return false;
}

function isCityPartnerSlot(slot) {
  return String(slot || '').trim().startsWith('networking_city_partner_');
}

function isCountyPartnerSlot(slot) {
  return String(slot || '').trim().startsWith('networking_county_partner_');
}

function isRegionPartnerSlot(slot) {
  return isCityPartnerSlot(slot) || isCountyPartnerSlot(slot);
}

/**
 * True when sponsor_available_from is set and that moment has passed
 * (placement end / slot re-opens for the next partner).
 */
function sponsorPlacementEnded(block, now = new Date()) {
  const raw = block?.sponsor_available_from;
  if (!raw) return false;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() <= now.getTime();
}

function isCompactSponsorSlot(slot) {
  const key = String(slot || '').trim();
  return key.endsWith('_sidebar_ad') || isRegionPartnerSlot(key);
}

/** Whether a cms_blocks row is ready for booking emails (logo/name + website link). */
function isEmailSponsorBlock(block) {
  if (!block || block.active === false) return false;
  if (sponsorPlacementEnded(block)) return false;
  if (!hasValidCtaUrl(block.cta_url)) return false;
  return hasSponsorLogo(block) || Boolean(sponsorCompanyName(block)) || Boolean(sponsorTagline(block));
}

/** Whether a cms_blocks row is ready to show on the public site for its slot. */
function isPublishableSponsorBlock(block, slot) {
  if (!block || block.active === false) return false;
  if (sponsorPlacementEnded(block)) return false;
  const key = String(slot || block.slot || '').trim();
  const ctaLabel = String(block.cta_label || '').trim();
  const ctaUrl = String(block.cta_url || '').trim();
  if (!hasValidCtaUrl(ctaUrl)) return false;

  // City/county partners + opportunity sidebar: logo + website only (no on-page button).
  if (isRegionPartnerSlot(key) || key.endsWith('_sidebar_ad')) return hasSponsorLogo(block);

  // Browse heroes: logo-only when a logo is set; otherwise tagline/company + CTA.
  if (hasSponsorLogo(block)) return true;
  if (!ctaLabel) return false;
  const tagline = sponsorTagline(block);
  const company = sponsorCompanyName(block);
  return Boolean(tagline) || Boolean(company);
}

function normalizeSponsorBlock(block) {
  if (!block) return null;
  return {
    ...block,
    title: sponsorTagline(block),
    subtitle: sponsorTagline(block),
    logo_url: sponsorLogoUrl(block) || null,
    image_url: sponsorLogoUrl(block) || null,
    company_name: sponsorCompanyName(block) || null,
    cta_color: sponsorCtaColor(block) || null,
    logo_band_dark: sponsorLogoBandDark(block),
    include_in_emails: block.include_in_emails !== false,
  };
}

function sponsorLogoBandDark(block) {
  if (!block) return false;
  return block.logo_band_dark === true;
}

function buildSponsorRow(payload) {
  const title = String(payload.title || '').trim();
  const body = String(payload.body || '').trim();
  const cta_label = String(payload.cta_label || '').trim();
  const cta_url = String(payload.cta_url || '').trim();
  const logo = String(payload.logo_url || '').trim() || null;
  const company_name = String(payload.company_name || '').trim() || null;
  const cta_color = sanitizeCtaColor(payload.cta_color) || null;
  const active = payload.active !== false;
  const include_in_emails = payload.include_in_emails !== false;
  const logo_band_dark = payload.logo_band_dark === true;
  const slot = String(payload.slot || 'sponsor_hub').trim() || 'sponsor_hub';

  const row = {
    slot,
    title,
    subtitle: title,
    body,
    cta_label,
    cta_url,
    cta_color,
    logo_url: logo,
    image_url: logo,
    company_name,
    active,
    include_in_emails,
    logo_band_dark,
    updated_at: new Date().toISOString(),
  };

  if (payload.sponsor_subscription_id !== undefined) {
    row.sponsor_subscription_id = payload.sponsor_subscription_id || null;
  }
  if (payload.sponsor_email !== undefined) {
    row.sponsor_email = payload.sponsor_email || null;
  }
  if (payload.sponsor_available_from !== undefined) {
    row.sponsor_available_from = payload.sponsor_available_from || null;
  }

  return row;
}

module.exports = {
  DEFAULT_CTA_COLOR,
  sponsorTagline,
  sponsorLogoUrl,
  sponsorCompanyName,
  sanitizeCtaColor,
  sponsorCtaColor,
  sponsorLogoBandDark,
  hasSponsorLogo,
  hasValidCtaUrl,
  isCompactSponsorSlot,
  isCityPartnerSlot,
  isCountyPartnerSlot,
  isRegionPartnerSlot,
  sponsorPlacementEnded,
  isEmailSponsorBlock,
  isPublishableSponsorBlock,
  normalizeSponsorBlock,
  buildSponsorRow,
};
