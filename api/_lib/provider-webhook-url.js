/** Short public webhook URLs (Eventbrite Payload URL field is ~70 chars in practice). */

const EVENTBRITE_PAYLOAD_URL_MAX = 70;
const WEBHOOK_TOKEN_BYTES = 12;
const WEBHOOK_TOKEN_HEX_LEN = WEBHOOK_TOKEN_BYTES * 2;

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

function newWebhookToken() {
  const crypto = require('crypto');
  return crypto.randomBytes(WEBHOOK_TOKEN_BYTES).toString('hex');
}

function providerFromShortCode(code) {
  return SHORT_CODE_TO_PROVIDER[String(code || '').trim().toLowerCase()] || '';
}

/** Canonical origin for pasted webhook URLs (no www — saves 4 chars for Eventbrite). */
function webhookPublicSite(site) {
  let base = String(site || '').replace(/\/$/, '');
  if (!base) base = 'https://thenetworkeruk.com';
  try {
    const u = new URL(base);
    if (u.hostname === 'www.thenetworkeruk.com') {
      u.hostname = 'thenetworkeruk.com';
    }
    return u.origin;
  } catch {
    return base.replace(/^https:\/\/www\.thenetworkeruk\.com/i, 'https://thenetworkeruk.com');
  }
}

function buildProviderWebhookPublicUrl(site, providerId, token) {
  const base = webhookPublicSite(site);
  const provider = String(providerId || '').trim().toLowerCase();
  const t = String(token || '').trim();
  if (!base || !provider || !t) return '';
  const code = PROVIDER_TO_SHORT_CODE[provider];
  if (!code) return '';
  return base + '/w/' + code + '/' + encodeURIComponent(t);
}

/** Parse /w/eb/{token} or legacy /api/w/eb/{token} */
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
  return String(url || '').length <= EVENTBRITE_PAYLOAD_URL_MAX;
}

function eventbriteWebhookNeedsTokenRotation(site, token) {
  const t = String(token || '').trim();
  if (!t) return false;
  if (t.length > WEBHOOK_TOKEN_HEX_LEN) return true;
  const url = buildProviderWebhookPublicUrl(site, 'eventbrite', t);
  return !eventbriteSafeUrlLength(url);
}

module.exports = {
  EVENTBRITE_PAYLOAD_URL_MAX,
  WEBHOOK_TOKEN_HEX_LEN,
  SHORT_CODE_TO_PROVIDER,
  PROVIDER_TO_SHORT_CODE,
  newWebhookToken,
  providerFromShortCode,
  webhookPublicSite,
  buildProviderWebhookPublicUrl,
  parseShortWebhookRoute,
  eventbriteSafeUrlLength,
  eventbriteWebhookNeedsTokenRotation,
};
