function siteBase(siteUrl) {
  return String(siteUrl || process.env.SITE_URL || 'https://www.thenetworkerhub.com').replace(
    /\/$/,
    ''
  );
}

const DEFAULT_PUBLIC_SITE = 'https://www.thenetworkerhub.com';

function isNonPublicSiteUrl(url) {
  const raw = String(url || '').trim().toLowerCase();
  if (!raw) return true;
  if (raw.includes('localhost') || raw.includes('127.0.0.1') || raw.startsWith('http://')) {
    return true;
  }
  return false;
}

/** Public HTTPS origin for email images — inbox clients cannot load localhost assets. */
function publicSiteBase(siteUrl) {
  const fromEnv = String(process.env.PUBLIC_SITE_URL || '').trim().replace(/\/$/, '');
  if (fromEnv && !isNonPublicSiteUrl(fromEnv)) return fromEnv;
  const site = siteBase(siteUrl);
  if (!isNonPublicSiteUrl(site)) return site;
  return DEFAULT_PUBLIC_SITE;
}

function toPublicAssetUrl(url, siteUrl) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^data:image\//i.test(raw)) return raw;
  const publicBase = publicSiteBase(siteUrl);
  if (/^https:\/\//i.test(raw) && !isNonPublicSiteUrl(raw)) return raw;
  if (raw.startsWith('//')) return 'https:' + raw;
  if (raw.startsWith('/')) return publicBase + raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      return publicBase + parsed.pathname + parsed.search;
    } catch {
      return raw;
    }
  }
  return publicBase + '/' + raw.replace(/^\/+/, '');
}

function homeUrl(siteUrl) {
  return siteBase(siteUrl) + '/';
}

function browseEventsUrl(siteUrl) {
  return siteBase(siteUrl) + '/events/';
}

function opportunitiesBrowseUrl(siteUrl) {
  return siteBase(siteUrl) + '/opportunities/';
}

function hubAccountUrl(siteUrl) {
  return siteBase(siteUrl) + '/account/';
}

function welcomeUrl(siteUrl) {
  return siteBase(siteUrl) + '/welcome';
}

function hubPaymentUrl(siteUrl, registrationId) {
  const base = hubAccountUrl(siteUrl);
  const id = String(registrationId || '').trim();
  if (!id) return base + '#payments';
  return base + '?booking=' + encodeURIComponent(id) + '#payments';
}

function legalPolicyUrl(siteUrl, section) {
  const key = String(section || 'overview').trim().replace(/^#/, '');
  const hash = key && key !== 'overview' ? '#' + key : '';
  return siteBase(siteUrl) + '/legal-policies' + hash;
}

function contactUrl(siteUrl) {
  return siteBase(siteUrl) + '/contact';
}

function eventPublicUrl(eventRow, siteUrl) {
  const site = siteBase(siteUrl);
  const slug = String(eventRow?.slug || '').trim();
  if (slug) return site + '/events/' + encodeURIComponent(slug);
  const id = String(eventRow?.id || '').trim();
  if (id) return site + '/events/event?id=' + encodeURIComponent(id);
  return browseEventsUrl(site);
}

function organiserPublicUrl(organiserRow, siteUrl) {
  const site = siteBase(siteUrl);
  const slug = String(organiserRow?.slug || '').trim();
  if (slug) return site + '/organisers/' + encodeURIComponent(slug);
  const id = String(organiserRow?.id || '').trim();
  if (id) return site + '/events/organiser?id=' + encodeURIComponent(id);
  return browseEventsUrl(site) + '#organisers';
}

function organiserDashboardUrl(siteUrl, options = {}) {
  const base = siteBase(siteUrl) + '/organiser/';
  const panel = String(options.panel || '').trim();
  const eventId = String(options.eventId || '').trim();
  const applications = String(options.applications || '').trim();
  const params = new URLSearchParams();
  if (panel) params.set('panel', panel.replace(/^#/, ''));
  if (eventId) params.set('eventId', eventId);
  if (applications) params.set('applications', applications);
  const qs = params.toString();
  // Query params survive email clients better than hash-only routes.
  const hash = panel ? '#' + panel.replace(/^#/, '') : '';
  return base + (qs ? '?' + qs : '') + hash;
}

function organiserBusinessDashboardUrl(siteUrl) {
  const base = siteBase(siteUrl) + '/organiser/';
  return base + '?panel=business-overview#business-overview';
}

function opportunityPublicUrl(opportunityRow, siteUrl) {
  const site = siteBase(siteUrl);
  const { publicOpportunitySlug } = require('./opportunity-slug');
  const slug = publicOpportunitySlug(opportunityRow);
  if (slug) return site + '/opportunities/' + encodeURIComponent(slug);
  const id = String(opportunityRow?.id || opportunityRow || '').trim();
  if (!id) return site + '/opportunities/';
  return site + '/opportunities/' + encodeURIComponent(id);
}

function logoNavUrl(siteUrl) {
  return toPublicAssetUrl('/assets/logo-nav.png', siteUrl);
}

function logoFooterUrl(siteUrl) {
  return toPublicAssetUrl('/assets/logo-email-footer.png', siteUrl);
}

function supportEmail() {
  const configured = String(process.env.SUPPORT_EMAIL || '').trim();
  if (configured) return configured.toLowerCase();

  const from = String(process.env.RESEND_FROM || '').trim();
  const angleMatch = from.match(/<([^>]+)>/);
  const raw = angleMatch ? angleMatch[1] : from;
  const parsed = String(raw || '')
    .trim()
    .toLowerCase();
  if (parsed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed)) {
    // Prefer the human inbox when Resend sends from mail.thenetworkerhub.com.
    if (parsed.endsWith('@mail.thenetworkerhub.com')) {
      return 'hello@thenetworkerhub.com';
    }
    return parsed;
  }

  return 'hello@thenetworkerhub.com';
}

module.exports = {
  siteBase,
  publicSiteBase,
  toPublicAssetUrl,
  isNonPublicSiteUrl,
  homeUrl,
  browseEventsUrl,
  opportunitiesBrowseUrl,
  hubAccountUrl,
  welcomeUrl,
  hubPaymentUrl,
  legalPolicyUrl,
  contactUrl,
  eventPublicUrl,
  organiserPublicUrl,
  organiserDashboardUrl,
  organiserBusinessDashboardUrl,
  opportunityPublicUrl,
  logoNavUrl,
  logoFooterUrl,
  supportEmail,
};
