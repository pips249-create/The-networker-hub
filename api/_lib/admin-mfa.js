/**
 * Admin-only TOTP MFA (step-up for Command Centre).
 * Not tied to Supabase Auth MFA — same email can use organiser/attendee without MFA.
 */
const crypto = require('crypto');
const { getSupabaseAdmin } = require('./supabase');

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function isAdminMfaEnforcementEnabled() {
  return String(process.env.ADMIN_MFA_REQUIRED || 'true').trim().toLowerCase() !== 'false';
}

function adminMfaMaxAgeSec() {
  const n = Number(process.env.ADMIN_MFA_MAX_AGE_SEC);
  return Number.isFinite(n) && n > 60 ? Math.floor(n) : 60 * 60 * 12;
}

function encryptionKey() {
  const raw = process.env.ADMIN_MFA_ENCRYPTION_KEY || process.env.SESSION_SECRET || '';
  if (!raw) throw new Error('SESSION_SECRET required for admin MFA');
  return crypto.createHash('sha256').update(String(raw)).digest();
}

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buffer.length; i += 1) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input) {
  const str = String(input || '')
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (let i = 0; i < str.length; i += 1) {
    const idx = BASE32_ALPHABET.indexOf(str[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

function decryptSecret(payload) {
  const parts = String(payload || '').split('.');
  if (parts.length !== 3) throw new Error('invalid_encrypted_secret');
  const iv = Buffer.from(parts[0], 'base64');
  const tag = Buffer.from(parts[1], 'base64');
  const data = Buffer.from(parts[2], 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

function generateSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function hotp(secret, counter, digits = 6) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const key = base32Decode(secret);
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(bin % 10 ** digits).padStart(digits, '0');
}

function totpAt(secret, unixSec, step = 30, digits = 6) {
  return hotp(secret, Math.floor(unixSec / step), digits);
}

function verifyTotp(secret, code, window = 1) {
  const normalized = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;
  const now = Math.floor(Date.now() / 1000);
  for (let w = -window; w <= window; w += 1) {
    if (totpAt(secret, now + w * 30) === normalized) return true;
  }
  return false;
}

function otpauthUri(email, secret) {
  const label = encodeURIComponent(`The Networker Hub:${email}`);
  const issuer = encodeURIComponent('The Networker Hub');
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

async function getAdminMfaRow(userId) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('admin_mfa_secrets')
    .select('user_id, secret_encrypted, enrolled_at, last_verified_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function isAdminMfaEnrolled(userId) {
  const row = await getAdminMfaRow(userId);
  return Boolean(row && row.secret_encrypted);
}

function isAdminMfaFresh(session) {
  if (!session || !session.adminMfaAt) return false;
  const at = Number(session.adminMfaAt);
  if (!Number.isFinite(at) || at <= 0) return false;
  return Math.floor(Date.now() / 1000) - at < adminMfaMaxAgeSec();
}

function adminMfaStatusForSession(session, enrolled) {
  if (!isAdminMfaEnforcementEnabled()) {
    return {
      required: false,
      enrollRequired: false,
      verified: true,
      enrolled: Boolean(enrolled),
      maxAgeSec: adminMfaMaxAgeSec(),
    };
  }
  const isEnrolled = Boolean(enrolled);
  const verified = isEnrolled && isAdminMfaFresh(session);
  return {
    required: isEnrolled && !verified,
    enrollRequired: !isEnrolled,
    verified,
    enrolled: isEnrolled,
    maxAgeSec: adminMfaMaxAgeSec(),
  };
}

async function enrollAdminMfa(userId, secret, code) {
  if (!verifyTotp(secret, code)) {
    const err = new Error('invalid_mfa_code');
    err.status = 400;
    throw err;
  }
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await sb.from('admin_mfa_secrets').upsert(
    {
      user_id: userId,
      secret_encrypted: encryptSecret(secret),
      enrolled_at: now,
      last_verified_at: now,
    },
    { onConflict: 'user_id' }
  );
  if (error) throw new Error(error.message);
  return { enrolledAt: now };
}

async function verifyAdminMfa(userId, code) {
  const row = await getAdminMfaRow(userId);
  if (!row) {
    const err = new Error('mfa_not_enrolled');
    err.status = 403;
    throw err;
  }
  const secret = decryptSecret(row.secret_encrypted);
  if (!verifyTotp(secret, code)) {
    const err = new Error('invalid_mfa_code');
    err.status = 400;
    throw err;
  }
  const now = new Date().toISOString();
  const sb = getSupabaseAdmin();
  await sb.from('admin_mfa_secrets').update({ last_verified_at: now }).eq('user_id', userId);
  return { verifiedAt: now };
}

module.exports = {
  isAdminMfaEnforcementEnabled,
  adminMfaMaxAgeSec,
  generateSecret,
  otpauthUri,
  verifyTotp,
  isAdminMfaEnrolled,
  isAdminMfaFresh,
  adminMfaStatusForSession,
  enrollAdminMfa,
  verifyAdminMfa,
};
