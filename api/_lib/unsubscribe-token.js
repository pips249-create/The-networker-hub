/**
 * Signed unsubscribe links for email footers and one-click List-Unsubscribe.
 * Payload is the recipient address — no account session required.
 */
const crypto = require('crypto');

const TOKEN_TYPE = 'email_unsubscribe';
const DEFAULT_TTL_DAYS = 730;

function unsubscribeSecret() {
  return String(process.env.SESSION_SECRET || '').trim();
}

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  return Buffer.from(String(str).replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64').toString('utf8');
}

function signUnsubscribePayload(payload, secret) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'HUB' }));
  const body = b64url(JSON.stringify(payload));
  const data = header + '.' + body;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return data + '.' + sig;
}

function createUnsubscribeToken(email, options) {
  const secret = unsubscribeSecret();
  const em = String(email || '').trim().toLowerCase();
  if (!secret || !em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return '';
  const opts = options && typeof options === 'object' ? options : {};
  const requestedTtl = Number(opts.ttlDays);
  const ttlDays = Number.isFinite(requestedTtl) ? requestedTtl : DEFAULT_TTL_DAYS;
  const exp = Math.floor(Date.now() / 1000) + ttlDays * 24 * 60 * 60;
  return signUnsubscribePayload({ typ: TOKEN_TYPE, email: em, exp }, secret);
}

function verifyUnsubscribeToken(token) {
  const secret = unsubscribeSecret();
  if (!token || !secret) return null;
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  const header = parts[0];
  const body = parts[1];
  const sig = parts[2];
  const data = header + '.' + body;
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body));
    if (payload.typ !== TOKEN_TYPE) return null;
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    const email = String(payload.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    return { email, exp: payload.exp || null };
  } catch {
    return null;
  }
}

function maskEmail(email) {
  const em = String(email || '').trim().toLowerCase();
  const at = em.indexOf('@');
  if (at < 1) return '';
  return em.slice(0, 1) + '***@' + em.slice(at + 1);
}

module.exports = {
  TOKEN_TYPE,
  createUnsubscribeToken,
  verifyUnsubscribeToken,
  maskEmail,
};
