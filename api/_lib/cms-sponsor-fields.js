/**
 * Sponsor Hub CMS block — normalize read/write across schema variants.
 * Production may use subtitle/image_url; newer code uses title/logo_url/company_name.
 */

function sponsorTagline(block) {
  if (!block) return '';
  const title = String(block.title || '').trim();
  if (title && title.toLowerCase() !== 'sponsor hub') return title;
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
  };
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
  const slot = String(payload.slot || 'sponsor_hub').trim() || 'sponsor_hub';

  return {
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
    updated_at: new Date().toISOString(),
  };
}

module.exports = {
  DEFAULT_CTA_COLOR,
  sponsorTagline,
  sponsorLogoUrl,
  sponsorCompanyName,
  sanitizeCtaColor,
  sponsorCtaColor,
  normalizeSponsorBlock,
  buildSponsorRow,
};
