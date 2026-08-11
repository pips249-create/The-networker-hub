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

/** Email preferences / unsubscribe destination (account settings). */
function unsubscribeUrl(siteUrl) {
  return siteBase(siteUrl) + '/account/settings#email-preferences';
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

/** Deep-link into organiser page edit (logo, website, description). */
function organiserGroupEditUrl(organiserRow, siteUrl, options = {}) {
  const site = siteBase(siteUrl);
  const id = String(organiserRow?.id || '').trim();
  if (!id) return site + '/organiser/#groups';
  const params = new URLSearchParams({ id });
  const onboard = String(options.onboard || '').trim();
  if (onboard) params.set('onboard', onboard);
  return site + '/organiser/group-edit?' + params.toString();
}

function organiserBusinessDashboardUrl(siteUrl, options = {}) {
  const base = siteBase(siteUrl) + '/organiser/';
  const renewId = String(options.renewOpportunityId || options.renew || '').trim();
  const hash = '#business-overview';
  if (renewId) {
    return base + '?renew=' + encodeURIComponent(renewId) + hash;
  }
  return base + hash;
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

/** Cache-bust so inbox clients pick up logo asset updates. */
const LOGO_ASSET_VERSION = '20260805footer';

function logoNavUrl(siteUrl) {
  return toPublicAssetUrl('/assets/logo-nav-transparent.png?v=' + LOGO_ASSET_VERSION, siteUrl);
}

function logoFooterUrl(siteUrl) {
  return toPublicAssetUrl('/assets/logo-email-footer.png?v=' + LOGO_ASSET_VERSION, siteUrl);
}

function hubertIconUrl(siteUrl) {
  return toPublicAssetUrl('/assets/hubert-icon.png?v=' + LOGO_ASSET_VERSION, siteUrl);
}

/**
 * Canonical public origin for every link in outbound email (never localhost).
 * Prefer PUBLIC_SITE_URL, then a public SITE_URL, else production.
 */
function emailSiteBase(siteUrl) {
  return publicSiteBase(siteUrl);
}

const EMAIL_URL_HTML_KEYS =
  /(_html|_row|_rows|_section|_block|_markup|listing_follow_on|recommendations|nearby_events|popular_events|location_footer)$/i;

/** Replace localhost / 127.0.0.1 origins in plain and URL-encoded form. */
function replaceLocalOrigins(value, publicBase) {
  const raw = String(value || '');
  if (!raw) return raw;
  const encodedPublic = encodeURIComponent(publicBase);
  return raw
    .replace(/https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/gi, publicBase)
    .replace(/https?%3A%2F%2F(?:localhost|127\.0\.0\.1)(?:%3A\d+)?/gi, encodedPublic);
}

/**
 * Rewrite localhost / private origins in email template variables to the public site.
 * Keeps logos on the public CDN and stops preview/test sends linking to 127.0.0.1.
 * Also rewrites localhost inside query params (e.g. login?next=http%3A%2F%2Flocalhost...).
 */
function rewriteEmailVarsToPublicSite(vars, siteUrl) {
  const publicBase = emailSiteBase(siteUrl);
  const out = vars && typeof vars === 'object' ? { ...vars } : {};
  const localOriginRe = /https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/gi;
  const localEncodedRe = /https?%3A%2F%2F(?:localhost|127\.0\.0\.1)(?:%3A\d+)?/gi;

  Object.keys(out).forEach(function (key) {
    const val = out[key];
    if (typeof val !== 'string' || !val) return;
    const hasLocal =
      localOriginRe.test(val) ||
      localEncodedRe.test(val) ||
      isNonPublicSiteUrl(val);
    localOriginRe.lastIndex = 0;
    localEncodedRe.lastIndex = 0;
    if (!hasLocal) return;

    if (EMAIL_URL_HTML_KEYS.test(key) || /<[^>]+>/.test(val)) {
      out[key] = replaceLocalOrigins(val, publicBase);
      return;
    }

    try {
      const parsed = new URL(val);
      if (isNonPublicSiteUrl(parsed.origin) || /localhost|127\.0\.0\.1/i.test(parsed.hostname)) {
        const rewritten = publicBase + parsed.pathname + parsed.search + parsed.hash;
        out[key] = replaceLocalOrigins(rewritten, publicBase);
      } else {
        out[key] = replaceLocalOrigins(val, publicBase);
      }
    } catch {
      out[key] = replaceLocalOrigins(val, publicBase);
    }
  });

  out.site_url = publicBase;
  return out;
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
  emailSiteBase,
  rewriteEmailVarsToPublicSite,
  toPublicAssetUrl,
  isNonPublicSiteUrl,
  homeUrl,
  browseEventsUrl,
  opportunitiesBrowseUrl,
  hubAccountUrl,
  unsubscribeUrl,
  welcomeUrl,
  hubPaymentUrl,
  legalPolicyUrl,
  contactUrl,
  eventPublicUrl,
  organiserPublicUrl,
  organiserDashboardUrl,
  organiserGroupEditUrl,
  organiserBusinessDashboardUrl,
  opportunityPublicUrl,
  logoNavUrl,
  logoFooterUrl,
  hubertIconUrl,
  supportEmail,
};
