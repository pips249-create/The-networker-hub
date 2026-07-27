/**
 * Email verification for organiser actions (publish, attendees, payouts, claims).
 * Primary UX: 6-digit code entered on /organiser/verify-email.
 * Legacy email links with ?token= still work for already-sent messages.
 */
const crypto = require('crypto');
const { getSupabaseAdmin } = require('./supabase');
const { sendTemplatedEmail } = require('./send-template-email');
const { getHubAccount } = require('./supabase-auth');

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function siteHost() {
  return String(process.env.SITE_URL || 'https://the-networker-hub.vercel.app').replace(/\/$/, '');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function newVerifyCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function newLegacyLinkToken() {
  return crypto.randomBytes(32).toString('base64url');
}

async function storeVerifyToken(userId, token) {
  const sb = getSupabaseAdmin();
  const uid = String(userId || '').trim();
  if (!uid) throw new Error('missing_user');

  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  const { error } = await sb
    .from('hub_accounts')
    .update({
      organiser_email_verify_token_hash: hashToken(token),
      organiser_email_verify_expires_at: expiresAt,
    })
    .eq('user_id', uid);
  if (error) throw new Error(error.message);
  return expiresAt;
}

async function clearVerifyToken(userId) {
  const sb = getSupabaseAdmin();
  await sb
    .from('hub_accounts')
    .update({
      organiser_email_verify_token_hash: null,
      organiser_email_verify_expires_at: null,
    })
    .eq('user_id', String(userId || '').trim());
}

async function markOrganiserEmailVerified(userId) {
  const sb = getSupabaseAdmin();
  const uid = String(userId || '').trim();
  if (!uid) throw new Error('missing_user');

  const now = new Date().toISOString();
  const { data, error } = await sb
    .from('hub_accounts')
    .update({
      organiser_email_verified_at: now,
      organiser_email_verify_token_hash: null,
      organiser_email_verify_expires_at: null,
    })
    .eq('user_id', uid)
    .select('user_id, organiser_email_verified_at')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('hub_account_not_found');
  return data;
}

async function sendOrganiserEmailVerification({ userId, email, name }) {
  const address = String(email || '')
    .trim()
    .toLowerCase();
  if (!address) {
    const err = new Error('missing_email');
    err.code = 'missing_email';
    throw err;
  }

  const code = newVerifyCode();
  await storeVerifyToken(userId, code);

  const verifyUrl =
    siteHost() +
    '/organiser/verify-email?email=' +
    encodeURIComponent(address);
  const displayName = String(name || '').trim() || address.split('@')[0];

  try {
    const result = await sendTemplatedEmail({
      slug: 'organiser_email_verify',
      to: address,
      variables: {
        user_name: displayName,
        user_email: address,
        verify_code: code,
        verify_url: verifyUrl,
      },
      skipEmailCheck: true,
    });
    return { ok: true, emailSent: true, verifyUrl: null, ...result };
  } catch (e) {
    const errCode = e.code || '';
    if (errCode === 'resend_not_configured') {
      const err = new Error('email_not_configured');
      err.code = 'email_not_configured';
      err.verifyUrl = verifyUrl;
      err.verifyCode = code;
      throw err;
    }
    throw e;
  }
}

async function verifyOrganiserEmailToken({ userId, token }) {
  const uid = String(userId || '').trim();
  const raw = String(token || '')
    .trim()
    .replace(/\s+/g, '');
  if (!uid || !raw) {
    const err = new Error('invalid_token');
    err.status = 400;
    throw err;
  }

  const hub = await getHubAccount(uid);
  if (!hub) {
    const err = new Error('hub_account_not_found');
    err.status = 404;
    throw err;
  }

  const expected = String(hub.organiser_email_verify_token_hash || '');
  const expires = hub.organiser_email_verify_expires_at
    ? new Date(hub.organiser_email_verify_expires_at).getTime()
    : 0;
  if (!expected || hashToken(raw) !== expected) {
    const err = new Error('invalid_token');
    err.status = 400;
    throw err;
  }
  if (!expires || expires < Date.now()) {
    await clearVerifyToken(uid);
    const err = new Error('token_expired');
    err.status = 400;
    throw err;
  }

  return markOrganiserEmailVerified(uid);
}

module.exports = {
  sendOrganiserEmailVerification,
  verifyOrganiserEmailToken,
  markOrganiserEmailVerified,
  newLegacyLinkToken,
};
