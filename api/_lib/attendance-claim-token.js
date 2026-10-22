/**
 * Signed links for organiser Yes/No on attendance claims.
 */
const crypto = require('crypto');

const TOKEN_TYPE = 'attendance_claim_decision';
const DEFAULT_TTL_DAYS = 14;

function claimTokenSecret() {
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

function signPayload(payload, secret) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'HUB' }));
  const body = b64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyAttendanceClaimToken(token) {
  const secret = claimTokenSecret();
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
    const claimId = String(payload.claimId || '').trim();
    const organiserId = String(payload.organiserId || '').trim();
    if (!claimId || !organiserId) return null;
    return { claimId, organiserId, exp: payload.exp || null };
  } catch {
    return null;
  }
}

function createAttendanceClaimToken(input, options) {
  const secret = claimTokenSecret();
  if (!secret) throw new Error('session_secret_missing');
  const claimId = String(input?.claimId || '').trim();
  const organiserId = String(input?.organiserId || '').trim();
  if (!claimId || !organiserId) throw new Error('missing_attendance_claim_fields');
  const opts = options && typeof options === 'object' ? options : {};
  const ttlDays = Number(opts.ttlDays) > 0 ? Number(opts.ttlDays) : DEFAULT_TTL_DAYS;
  const exp = Math.floor(Date.now() / 1000) + ttlDays * 24 * 60 * 60;
  return signPayload(
    {
      typ: TOKEN_TYPE,
      claimId,
      organiserId,
      exp,
    },
    secret
  );
}

module.exports = {
  createAttendanceClaimToken,
  verifyAttendanceClaimToken,
  TOKEN_TYPE,
  DEFAULT_TTL_DAYS,
};
