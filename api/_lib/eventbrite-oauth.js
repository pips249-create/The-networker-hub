/**
 * Eventbrite OAuth 2.0 (authorization code) for Connected booking.
 * Tokens are permanent Bearer tokens — same shape as a private API token.
 */
const crypto = require('crypto');

const AUTHORIZE_URL = 'https://www.eventbrite.com/oauth/authorize';
const TOKEN_URL = 'https://www.eventbrite.com/oauth/token';
const OAUTH_STATE_TTL_SEC = 15 * 60;

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  return Buffer.from(String(str || '').replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64').toString(
    'utf8'
  );
}

function signPayload(payload, secret) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const data = header + '.' + body;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return data + '.' + sig;
}

function verifyPayload(token, secret) {
  if (!token || !secret) return null;
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  const data = parts[0] + '.' + parts[1];
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(parts[2]), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(b64urlDecode(parts[1]));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function eventbriteOAuthClientId() {
  return String(
    process.env.EVENTBRITE_CLIENT_ID ||
      process.env.EVENTBRITE_API_KEY ||
      process.env.EVENTBRITE_APP_KEY ||
      ''
  ).trim();
}

function eventbriteOAuthClientSecret() {
  return String(
    process.env.EVENTBRITE_CLIENT_SECRET || process.env.EVENTBRITE_APP_SECRET || ''
  ).trim();
}

function eventbriteOAuthRedirectUri() {
  const explicit = String(process.env.EVENTBRITE_OAUTH_REDIRECT_URI || '').trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const site = String(process.env.SITE_URL || 'https://www.thenetworkeruk.com').replace(/\/$/, '');
  return site + '/api/integrations/eventbrite/oauth/callback';
}

function eventbriteOAuthConfigured() {
  return Boolean(eventbriteOAuthClientId() && eventbriteOAuthClientSecret());
}

function oauthSigningSecret() {
  return String(
    process.env.SESSION_SECRET || process.env.EVENTBRITE_OAUTH_STATE_SECRET || ''
  ).trim();
}

function signEventbriteOAuthState(payload) {
  const secret = oauthSigningSecret();
  if (!secret) {
    const e = new Error('SESSION_SECRET is required for Eventbrite OAuth.');
    e.status = 503;
    e.code = 'oauth_state_secret_missing';
    throw e;
  }
  const now = Math.floor(Date.now() / 1000);
  return signPayload(
    Object.assign({}, payload || {}, {
      purpose: 'eventbrite_oauth',
      iat: now,
      exp: now + OAUTH_STATE_TTL_SEC,
      nonce: crypto.randomBytes(8).toString('hex'),
    }),
    secret
  );
}

function verifyEventbriteOAuthState(state) {
  const secret = oauthSigningSecret();
  if (!secret) return null;
  const payload = verifyPayload(String(state || '').trim(), secret);
  if (!payload || payload.purpose !== 'eventbrite_oauth') return null;
  if (!payload.accountId) return null;
  return payload;
}

function buildEventbriteAuthorizeUrl(state) {
  if (!eventbriteOAuthConfigured()) {
    const e = new Error(
      'Eventbrite OAuth is not configured. Set EVENTBRITE_CLIENT_ID and EVENTBRITE_CLIENT_SECRET.'
    );
    e.status = 503;
    e.code = 'eventbrite_oauth_not_configured';
    throw e;
  }
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: eventbriteOAuthClientId(),
    redirect_uri: eventbriteOAuthRedirectUri(),
  });
  if (state) params.set('state', String(state));
  return AUTHORIZE_URL + '?' + params.toString();
}

async function exchangeEventbriteOAuthCode(code) {
  const accessCode = String(code || '').trim();
  if (!accessCode) {
    const e = new Error('Missing Eventbrite authorization code.');
    e.status = 400;
    e.code = 'missing_oauth_code';
    throw e;
  }
  if (!eventbriteOAuthConfigured()) {
    const e = new Error(
      'Eventbrite OAuth is not configured. Set EVENTBRITE_CLIENT_ID and EVENTBRITE_CLIENT_SECRET.'
    );
    e.status = 503;
    e.code = 'eventbrite_oauth_not_configured';
    throw e;
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: eventbriteOAuthClientId(),
    client_secret: eventbriteOAuthClientSecret(),
    code: accessCode,
    redirect_uri: eventbriteOAuthRedirectUri(),
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  const accessToken = String(
    (data && (data.access_token || data.token || data.accessToken)) || ''
  ).trim();
  if (!res.ok || !accessToken) {
    const e = new Error(
      (data && (data.error_description || data.error)) ||
        'eventbrite_oauth_token_exchange_failed'
    );
    e.status = res.status >= 400 && res.status < 600 ? res.status : 502;
    e.code = 'eventbrite_oauth_exchange_failed';
    e.eventbriteStatus = res.status;
    throw e;
  }
  return {
    accessToken,
    tokenType: String((data && data.token_type) || 'Bearer').trim(),
    raw: data,
  };
}

function safeReturnPath(raw, fallback) {
  const value = String(raw || '').trim();
  if (!value) return fallback || '/organiser/#connected-booking';
  if (!value.startsWith('/') || value.startsWith('//')) {
    return fallback || '/organiser/#connected-booking';
  }
  return value;
}

module.exports = {
  AUTHORIZE_URL,
  TOKEN_URL,
  eventbriteOAuthClientId,
  eventbriteOAuthClientSecret,
  eventbriteOAuthRedirectUri,
  eventbriteOAuthConfigured,
  signEventbriteOAuthState,
  verifyEventbriteOAuthState,
  buildEventbriteAuthorizeUrl,
  exchangeEventbriteOAuthCode,
  safeReturnPath,
};
