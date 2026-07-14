/**
 * Allowed browser origins for credentialed API requests (CORS).
 */
const LOCAL_ORIGINS = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

function normalizeOrigin(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw).origin;
  } catch {
    return '';
  }
}

function configuredSiteOrigins() {
  const out = new Set();
  const siteUrl = normalizeOrigin(process.env.SITE_URL);
  if (siteUrl) out.add(siteUrl);
  out.add('https://www.thenetworkerhub.com');
  out.add('https://thenetworkerhub.com');
  out.add('https://www.thenetworkerhub.co.uk');
  out.add('https://thenetworkerhub.co.uk');
  out.add('https://the-networker-hub.vercel.app');
  return out;
}

function isAllowedOrigin(origin) {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  if (LOCAL_ORIGINS.has(normalized)) return true;
  if (configuredSiteOrigins().has(normalized)) return true;
  if (process.env.VERCEL_ENV !== 'production' && /\.vercel\.app$/i.test(normalized)) {
    return true;
  }
  return false;
}

module.exports = {
  isAllowedOrigin,
  normalizeOrigin,
  configuredSiteOrigins,
};
