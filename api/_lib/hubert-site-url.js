/**
 * Public site base URL for Hubert listing links.
 */
function hubSiteBase() {
  return String(process.env.SITE_URL || 'https://www.thenetworkerhub.com').replace(/\/$/, '');
}

function hubSiteUrl(path) {
  const base = hubSiteBase();
  const raw = String(path || '').trim();
  if (!raw) return base;
  if (/^https?:\/\//i.test(raw)) return raw;
  return base + (raw.startsWith('/') ? raw : '/' + raw);
}

function hubEventUrl(slug) {
  return hubSiteUrl('/events/' + String(slug || '').replace(/^\/+/, ''));
}

function hubOpportunityUrl(id) {
  return hubSiteUrl('/opportunities/' + String(id || '').replace(/^\/+/, ''));
}

module.exports = {
  hubSiteBase,
  hubSiteUrl,
  hubEventUrl,
  hubOpportunityUrl,
};
