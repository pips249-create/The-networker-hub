const HOME_PARTNERS_SLOT = 'home_partners';

function parsePartnersBody(body) {
  if (!body) return [];
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      return Array.isArray(parsed.partners) ? parsed.partners : [];
    } catch {
      return [];
    }
  }
  if (typeof body === 'object' && Array.isArray(body.partners)) {
    return body.partners;
  }
  return [];
}

function serializePartnersBody(partners) {
  return JSON.stringify({ partners: partners || [] });
}

function normalizePartner(raw, index) {
  const id = String(raw?.id || `partner_${Date.now()}_${index}`).trim();
  return {
    id,
    company_name: String(raw?.company_name || raw?.companyName || '').trim(),
    logo_url: String(raw?.logo_url || raw?.logoUrl || '').trim(),
    cta_url: String(raw?.cta_url || raw?.ctaUrl || '').trim(),
    cta_label: String(raw?.cta_label || raw?.ctaLabel || 'Visit website').trim(),
    active: raw?.active !== false,
  };
}

function normalizePartnersList(list) {
  return (Array.isArray(list) ? list : []).map(normalizePartner).filter((p) => p.company_name || p.logo_url);
}

function hasValidPartnerLogo(url) {
  return /^(https?:|\/|data:image\/)/i.test(String(url || '').trim());
}

function hasValidPartnerCta(url) {
  return /^(https?:|mailto:)/i.test(String(url || '').trim());
}

function publishablePartners(partners) {
  return normalizePartnersList(partners).filter(
    (p) => p.active && hasValidPartnerLogo(p.logo_url) && hasValidPartnerCta(p.cta_url)
  );
}

module.exports = {
  HOME_PARTNERS_SLOT,
  parsePartnersBody,
  serializePartnersBody,
  normalizePartner,
  normalizePartnersList,
  publishablePartners,
  hasValidPartnerLogo,
  hasValidPartnerCta,
};
