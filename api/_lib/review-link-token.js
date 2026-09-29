/**
 * Signed links in post-event review emails — one tap to review without signing in.
 */
const crypto = require('crypto');

const TOKEN_TYPE = 'post_event_review';
const DEFAULT_TTL_DAYS = 120;

function reviewLinkSecret() {
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
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64').toString('utf8');
}

function signReviewLinkPayload(payload, secret) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'HUB' }));
  const body = b64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyReviewLinkToken(token) {
  const secret = reviewLinkSecret();
  if (!token || !secret) return null;
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const data = `${header}.${body}`;
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(b64urlDecode(body));
    if (payload.typ !== TOKEN_TYPE) return null;
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    const registrationId = String(payload.registrationId || '').trim();
    const eventId = String(payload.eventId || '').trim();
    const attendeeId = String(payload.attendeeId || '').trim();
    if (!registrationId || !eventId || !attendeeId) return null;
    return { registrationId, eventId, attendeeId, exp: payload.exp || null };
  } catch {
    return null;
  }
}

function createReviewLinkToken(input, options) {
  const secret = reviewLinkSecret();
  if (!secret) throw new Error('session_secret_missing');
  const registrationId = String(input?.registrationId || '').trim();
  const eventId = String(input?.eventId || '').trim();
  const attendeeId = String(input?.attendeeId || '').trim();
  if (!registrationId || !eventId || !attendeeId) throw new Error('missing_review_link_fields');
  const opts = options && typeof options === 'object' ? options : {};
  const ttlDays = Number(opts.ttlDays) > 0 ? Number(opts.ttlDays) : DEFAULT_TTL_DAYS;
  const exp = Math.floor(Date.now() / 1000) + ttlDays * 24 * 60 * 60;
  return signReviewLinkPayload(
    {
      typ: TOKEN_TYPE,
      registrationId,
      eventId,
      attendeeId,
      exp,
    },
    secret
  );
}

module.exports = {
  createReviewLinkToken,
  verifyReviewLinkToken,
  TOKEN_TYPE,
};
