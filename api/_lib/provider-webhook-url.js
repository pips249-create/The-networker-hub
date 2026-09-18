/** Short public webhook URLs (Eventbrite Payload URL is ~74 chars max). */

const SHORT_CODE_TO_PROVIDER = {
  eb: 'eventbrite',
  tt: 'ticket_tailor',
  lu: 'luma',
  tb: 'trybooking',
  os: 'own_site',
};

const PROVIDER_TO_SHORT_CODE = Object.fromEntries(
  Object.entries(SHORT_CODE_TO_PROVIDER).map(([code, id]) => [id, code])
);

/** New tokens: 16 bytes → 32 hex (fits Eventbrite with /api/w/{code}/ prefix). */
function newWebhookToken() {
  const crypto = require('crypto');
  return crypto.randomBytes(16).toString('hex');
}

function providerFromShortCode(code) {
  return SHORT_CODE_TO_PROVIDER[String(code || '').trim().toLowerCase()] || '';
}

function buildProviderWebhookPublicUrl(site, providerId, token) {
  const base = String(site || '').replace(/\/$/, '');
  const provider = String(providerId || '').trim().toLowerCase();
  const t = String(token || '').trim();
  if (!base || !provider || !t) return '';
  const code = PROVIDER_TO_SHORT_CODE[provider];
  if (!code) return '';
  return base + '/api/w/' + code + '/' + encodeURIComponent(t);
}

/** Parse /api/w/eb/{token} */
function parseShortWebhookRoute(req) {
  let pathname = '';
  if (req.url) {
    try {
      pathname = new URL(req.url, 'https://internal.local').pathname;
    } catch {
      pathname = String(req.url).split('?')[0];
    }
  }
  const parts = pathname.split('/').filter(Boolean);
  const wIdx = parts.indexOf('w');
  if (wIdx < 0 || parts.length < wIdx + 3) return null;
  const code = parts[wIdx + 1];
  const token = decodeURIComponent(parts.slice(wIdx + 2).join('/') || '');
  const provider = providerFromShortCode(code);
  if (!provider || !token) return null;
  return { provider, token };
}

function eventbriteSafeUrlLength(url) {
  return String(url || '').length <= 74;
}

module.exports = {
  SHORT_CODE_TO_PROVIDER,
  PROVIDER_TO_SHORT_CODE,
  newWebhookToken,
  providerFromShortCode,
  buildProviderWebhookPublicUrl,
  parseShortWebhookRoute,
  eventbriteSafeUrlLength,
};
