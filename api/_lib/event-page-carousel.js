const EVENT_PAGE_CAROUSEL_SLOT = 'event_page_carousel_ads';
const EVENT_PAGE_CAROUSEL_SIZE = 3;
const EVENT_EMAIL_MINI_SPONSORS_SLOT = 'event_email_mini_sponsors';
const ORGANISER_EMAIL_MINI_SPONSORS_SLOT = 'organiser_email_mini_sponsors';
const OPPORTUNITY_EMAIL_MINI_SPONSORS_SLOT = 'opportunity_email_mini_sponsors';
const EMAIL_MINI_SPONSOR_SLOTS = new Set([
  EVENT_PAGE_CAROUSEL_SLOT,
  EVENT_EMAIL_MINI_SPONSORS_SLOT,
  ORGANISER_EMAIL_MINI_SPONSORS_SLOT,
  OPPORTUNITY_EMAIL_MINI_SPONSORS_SLOT,
]);

function parseCarouselBody(body) {
  if (!body) return [];
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      return Array.isArray(parsed.ads) ? parsed.ads : [];
    } catch {
      return [];
    }
  }
  if (typeof body === 'object' && Array.isArray(body.ads)) {
    return body.ads;
  }
  return [];
}

function serializeCarouselBody(ads) {
  return JSON.stringify({ ads: ads || [] });
}

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

function normalizeCarouselAd(raw, index) {
  const id = String(raw?.id || `event_carousel_${index + 1}`).trim();
  return {
    id,
    slot_index: Number.isFinite(Number(raw?.slot_index)) ? Number(raw.slot_index) : index,
    company_name: String(raw?.company_name || raw?.companyName || '').trim(),
    logo_url: String(raw?.logo_url || raw?.logoUrl || '').trim(),
    cta_url: String(raw?.cta_url || raw?.ctaUrl || '').trim(),
    cta_label: String(raw?.cta_label || raw?.ctaLabel || 'Enquire now').trim(),
    cta_color: sanitizeCtaColor(raw?.cta_color || raw?.ctaColor) || '',
    active: raw?.active !== false,
  };
}

function normalizeCarouselAdsList(list) {
  const incoming = Array.isArray(list) ? list : [];
  const byIndex = new Map();
  incoming.forEach((raw, index) => {
    const ad = normalizeCarouselAd(raw, index);
    const slotIndex = Math.min(Math.max(ad.slot_index, 0), EVENT_PAGE_CAROUSEL_SIZE - 1);
    ad.slot_index = slotIndex;
    byIndex.set(slotIndex, ad);
  });

  const out = [];
  for (let i = 0; i < EVENT_PAGE_CAROUSEL_SIZE; i++) {
    if (byIndex.has(i)) {
      out.push(byIndex.get(i));
      continue;
    }
    out.push(
      normalizeCarouselAd(
        {
          id: `event_carousel_${i + 1}`,
          slot_index: i,
          active: false,
        },
        i
      )
    );
  }
  return out;
}

function hasValidCarouselLogo(url) {
  return /^(https?:|\/|data:image\/)/i.test(String(url || '').trim());
}

function hasValidCarouselCta(url) {
  return /^(https?:|mailto:)/i.test(String(url || '').trim());
}

function isPublishableCarouselAd(ad) {
  if (!ad || ad.active === false) return false;
  return hasValidCarouselLogo(ad.logo_url) && hasValidCarouselCta(ad.cta_url);
}

function publishableCarouselAds(ads) {
  return normalizeCarouselAdsList(ads).filter(isPublishableCarouselAd);
}

module.exports = {
  EVENT_PAGE_CAROUSEL_SLOT,
  EVENT_PAGE_CAROUSEL_SIZE,
  EVENT_EMAIL_MINI_SPONSORS_SLOT,
  ORGANISER_EMAIL_MINI_SPONSORS_SLOT,
  OPPORTUNITY_EMAIL_MINI_SPONSORS_SLOT,
  EMAIL_MINI_SPONSOR_SLOTS,
  parseCarouselBody,
  serializeCarouselBody,
  normalizeCarouselAd,
  normalizeCarouselAdsList,
  publishableCarouselAds,
  isPublishableCarouselAd,
  hasValidCarouselLogo,
  hasValidCarouselCta,
  sanitizeCtaColor,
};
