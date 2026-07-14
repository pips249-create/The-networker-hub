const crypto = require('crypto');
const { authenticator } = require('otplib');
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');

authenticator.options = { window: 1 };

const ISSUER = 'The Networker Hub';

/** Opt-in: set ADMIN_MFA_ENABLED=true in Vercel when ready (works with Microsoft Authenticator). */
function isAdminMfaEnabled() {
  return String(process.env.ADMIN_MFA_ENABLED || '').trim().toLowerCase() === 'true';
}

function encryptionKey() {
  const secret = String(process.env.SESSION_SECRET || '').trim();
  if (!secret) return null;
  return crypto.createHash('sha256').update('hub-admin-mfa:' + secret).digest();
}

function encryptSecret(plain) {
  const key = encryptionKey();
  if (!key) throw new Error('SESSION_SECRET is required for MFA');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
}

function decryptSecret(stored) {
  const key = encryptionKey();
  if (!key || !stored) return null;
  const parts = String(stored).split(':');
  if (parts.length !== 3) return null;
  try {
    const iv = Buffer.from(parts[0], 'base64');
    const tag = Buffer.from(parts[1], 'base64');
    const data = Buffer.from(parts[2], 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

async function getEnrollment(userId) {
  if (!isSupabaseConfigured() || !userId) return null;
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('admin_mfa_secrets')
    .select('user_id, enrolled_at, last_verified_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

async function isMfaEnrolled(userId) {
  const row = await getEnrollment(userId);
  return Boolean(row);
}

async function verifyUserCode(userId, code) {
  if (!isSupabaseConfigured() || !userId) return false;
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('admin_mfa_secrets')
    .select('secret_encrypted')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data?.secret_encrypted) return false;

  const secret = decryptSecret(data.secret_encrypted);
  if (!secret) return false;
  const ok = authenticator.check(String(code || '').replace(/\s/g, ''), secret);
  if (!ok) return false;

  await sb
    .from('admin_mfa_secrets')
    .update({ last_verified_at: new Date().toISOString() })
    .eq('user_id', userId);
  return true;
}

function beginEnrollment(email) {
  const secret = authenticator.generateSecret();
  const label = String(email || 'admin').trim().toLowerCase();
  const otpauthUrl = authenticator.keyuri(label, ISSUER, secret);
  return { secret, otpauthUrl };
}

function verifyPendingEnrollment(secret, code) {
  return authenticator.check(String(code || '').replace(/\s/g, ''), String(secret || ''));
}

async function confirmEnrollment(userId, secret) {
  if (!isSupabaseConfigured() || !userId || !secret) {
    throw new Error('MFA enrollment is not available');
  }
  const sb = getSupabaseAdmin();
  const encrypted = encryptSecret(secret);
  const { error } = await sb.from('admin_mfa_secrets').upsert(
    {
      user_id: userId,
      secret_encrypted: encrypted,
      enrolled_at: new Date().toISOString(),
      last_verified_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (error) throw new Error(error.message || 'Could not save MFA secret');
  return true;
}

async function disableEnrollment(userId, code) {
  const ok = await verifyUserCode(userId, code);
  if (!ok) return false;
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('admin_mfa_secrets').delete().eq('user_id', userId);
  if (error) throw new Error(error.message || 'Could not disable MFA');
  return true;
}

function requireMfaVerified(session) {
  if (!session) return { ok: false, status: 401, error: 'not_authenticated' };
  if (!isAdminMfaEnabled()) return { ok: true };
  if (session.mfaEnrolled && !session.mfaVerified) {
    return {
      ok: false,
      status: 403,
      error: 'mfa_required',
      message: 'Enter your authenticator code to access the Command Centre.',
    };
  }
  return { ok: true };
}

module.exports = {
  beginEnrollment,
  confirmEnrollment,
  disableEnrollment,
  getEnrollment,
  isAdminMfaEnabled,
  isMfaEnrolled,
  requireMfaVerified,
  verifyPendingEnrollment,
  verifyUserCode,
};
