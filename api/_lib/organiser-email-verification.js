/**
 * Email verification for account signup and organiser actions (publish, attendees, payouts, claims).
 * Primary UX: 6-digit code entered on /organiser/verify-email right after create-account.
 * Legacy email links with ?token= still work for already-sent messages.
 */
const crypto = require('crypto');
const { getSupabaseAdmin } = require('./supabase');
const { sendTemplatedEmail } = require('./send-template-email');
const { getHubAccount } = require('./supabase-auth');
const { emailSiteBase } = require('./hub-email-urls');
const {
  buildOrganiserVerifyEmailPath,
  verifyEmailPagePath,
} = require('./organiser-email-verify-paths');

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function siteHost() {
  return emailSiteBase(process.env.SITE_URL);
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

async function ensureHubAccountRow(userId) {
  const sb = getSupabaseAdmin();
  const uid = String(userId || '').trim();
  if (!uid) throw new Error('missing_user');

  const existing = await getHubAccount(uid);
  if (existing) return existing;

  const { error } = await sb.from('hub_accounts').upsert(
    {
      user_id: uid,
      role: 'client',
      hub_view: 'attendee',
    },
    { onConflict: 'user_id' }
  );
  if (error) throw new Error(error.message);
  return getHubAccount(uid);
}

async function storeVerifyToken(userId, token, options = {}) {
  const sb = getSupabaseAdmin();
  const uid = String(userId || '').trim();
  if (!uid) throw new Error('missing_user');

  await ensureHubAccountRow(uid);

  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  const onlyIfUnverified = Boolean(options.onlyIfUnverified);
  // Issuing a fresh code normally re-opens confirmation — prior staff/provision
  // verified_at flags must not let Welcome or the verify page skip the code.
  // Reminder cron passes onlyIfUnverified so a confirm that won the race is not undone.
  let query = sb
    .from('hub_accounts')
    .update({
      organiser_email_verify_token_hash: hashToken(token),
      organiser_email_verify_expires_at: expiresAt,
      organiser_email_verified_at: null,
    })
    .eq('user_id', uid);
  if (onlyIfUnverified) {
    query = query.is('organiser_email_verified_at', null);
  }
  const { data, error } = await query.select('user_id').maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.user_id) {
    if (onlyIfUnverified) {
      const hub = await getHubAccount(uid);
      if (hub?.organiser_email_verified_at) {
        const err = new Error('already_verified');
        err.code = 'already_verified';
        throw err;
      }
    }
    const err = new Error('hub_account_not_found');
    err.code = 'hub_account_not_found';
    throw err;
  }
  return expiresAt;
}

function hasActiveVerifyCode(hub) {
  if (!hub?.organiser_email_verify_token_hash || !hub.organiser_email_verify_expires_at) {
    return false;
  }
  return new Date(hub.organiser_email_verify_expires_at).getTime() > Date.now();
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

/**
 * Self-serve signup must prove inbox access with a fresh code.
 * Staff provisioning / silent imports set organiser_email_verified_at without
 * an inbox check — clear that so Welcome cannot fire until confirm succeeds.
 */
async function clearOrganiserEmailVerification(userId) {
  const sb = getSupabaseAdmin();
  const uid = String(userId || '').trim();
  if (!uid) throw new Error('missing_user');

  const { error } = await sb
    .from('hub_accounts')
    .update({
      organiser_email_verified_at: null,
      organiser_email_verify_token_hash: null,
      organiser_email_verify_expires_at: null,
    })
    .eq('user_id', uid);
  if (error) throw new Error(error.message);
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

async function sendOrganiserEmailVerification({ userId, email, name, revealCode, slug }) {
  const address = String(email || '')
    .trim()
    .toLowerCase();
  if (!address) {
    const err = new Error('missing_email');
    err.code = 'missing_email';
    throw err;
  }

  const emailSlug =
    String(slug || '').trim() === 'organiser_email_verify_reminder'
      ? 'organiser_email_verify_reminder'
      : 'organiser_email_verify';
  const reminderSend = emailSlug === 'organiser_email_verify_reminder';

  const code = newVerifyCode();
  await storeVerifyToken(userId, code, { onlyIfUnverified: reminderSend });

  // Email CTA includes the code so the confirm page can prefill it. The page
  // still requires an explicit Confirm click (no auto-submit) so mail scanners
  // cannot mark the address verified or fire Welcome early.
  const emailVerifyPath = buildOrganiserVerifyEmailPath(code, address);
  const verifyUrl = siteHost() + emailVerifyPath;
  // In-app redirects stay code-free; only the inbox link carries the digits.
  const safeVerifyPath = verifyEmailPagePath(address);
  const displayName = String(name || '').trim() || address.split('@')[0];
  const shouldRevealCode = Boolean(revealCode);

  try {
    const result = await sendTemplatedEmail({
      slug: emailSlug,
      to: address,
      variables: {
        user_name: displayName,
        user_email: address,
        verify_code: code,
        verify_url: verifyUrl,
      },
      skipEmailCheck: true,
      resendTags: [{ name: 'category', value: emailSlug }],
    });
    const out = {
      ok: true,
      emailSent: true,
      verifyUrl: null,
      // Never hand a code-bearing path to the browser after signup/enable.
      verifyPath: safeVerifyPath,
      ...result,
    };
    if (shouldRevealCode) {
      out.verifyUrl = verifyUrl;
      out.verifyCode = code;
    }
    return out;
  } catch (e) {
    const errCode = e.code || '';
    if (errCode === 'resend_not_configured') {
      const err = new Error('email_not_configured');
      err.code = 'email_not_configured';
      err.verifyUrl = verifyUrl;
      err.verifyCode = code;
      err.verifyPath = safeVerifyPath;
      throw err;
    }
    // Keep the stored code so a signed-in user / admin can still confirm without inbox delivery.
    e.verifyUrl = verifyUrl;
    e.verifyCode = code;
    e.verifyPath = safeVerifyPath;
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
  clearOrganiserEmailVerification,
  buildOrganiserVerifyEmailPath,
  hasActiveVerifyCode,
  newLegacyLinkToken,
};
