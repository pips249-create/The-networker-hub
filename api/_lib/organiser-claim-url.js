/**
 * Deep-links for organiser profile claim campaigns.
 *
 * Email 2 path B: land on their public organiser page first so they can see the
 * listing (and siblings / events) before creating a password. Claim / Edit then
 * goes to register or login → /organiser/?onboard=claim.
 *
 * Soft path A (/for-organisers) remains as a fallback when no public slug exists.
 *
 * Auth users created by silent import (never signed in) still set a password via /register.
 */
const sbAuth = require('./supabase-auth');

const CLAIM_NEXT = '/organiser/?onboard=claim';

function encodeNext(path) {
  return encodeURIComponent(String(path || CLAIM_NEXT));
}

function claimQuery(em, authMode) {
  const next = encodeNext(CLAIM_NEXT);
  const intent = 'organiser-claim';
  const auth = authMode === 'login' ? 'login' : 'register';
  return (
    'email=' +
    encodeURIComponent(em) +
    '&intent=' +
    intent +
    '&auth=' +
    auth +
    '&next=' +
    next
  );
}

/** Soft path A — marketing page first (fallback when no public slug). */
function softPathClaimUrl(base, em, authMode) {
  return String(base || '').replace(/\/$/, '') + '/for-organisers?' + claimQuery(em, authMode);
}

/**
 * Path B — public organiser listing first.
 * @param {string} base
 * @param {string} em
 * @param {'login'|'register'} authMode
 * @param {string} [slug] public organiser slug; falls back to soft path when missing
 */
function previewClaimUrl(base, em, authMode, slug) {
  const s = String(slug || '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
  if (!s) return softPathClaimUrl(base, em, authMode);
  return (
    String(base || '').replace(/\/$/, '') +
    '/organisers/' +
    encodeURIComponent(s) +
    '?' +
    claimQuery(em, authMode)
  );
}

/**
 * Register/login unless they have already signed in at least once.
 * Email must match the organiser group profile on file.
 * @param {string} email
 * @param {string} host
 * @param {string} [slug]
 */
async function resolveOrganiserClaimUrl(email, host, slug) {
  const em = String(email || '')
    .trim()
    .toLowerCase();
  const base = String(host || '').replace(/\/$/, '');

  const user = await sbAuth.findUserByEmail(em);
  if (!user || !user.lastSignInAt) {
    return previewClaimUrl(base, em, 'register', slug);
  }

  return previewClaimUrl(base, em, 'login', slug);
}

/** Direct auth URL after they have reviewed their listing (Claim / Edit CTA). */
function authClaimUrl(base, em, authMode) {
  const next = encodeNext(CLAIM_NEXT);
  const intent = 'organiser-claim';
  const path = authMode === 'login' ? '/login' : '/register';
  return (
    String(base || '').replace(/\/$/, '') +
    path +
    '?email=' +
    encodeURIComponent(em) +
    '&next=' +
    next +
    '&intent=' +
    intent
  );
}

module.exports = {
  CLAIM_NEXT,
  resolveOrganiserClaimUrl,
  previewClaimUrl,
  softPathClaimUrl,
  authClaimUrl,
};
