/**
 * Deep-links for organiser profile claim campaigns.
 *
 * Email 2 (soft path): land on /for-organisers first so people can see what the Hub
 * is before creating a password. The page turns intent=organiser-claim into a
 * “Confirm your page” CTA that goes to register or login.
 *
 * Auth users created by silent import (never signed in) still set a password via /register.
 */
const sbAuth = require('./supabase-auth');

const CLAIM_NEXT = '/organiser/?onboard=claim';

function encodeNext(path) {
  return encodeURIComponent(String(path || CLAIM_NEXT));
}

/** Preview-first claim entry (Email 2 soft path). */
function previewClaimUrl(base, em, authMode) {
  const next = encodeNext(CLAIM_NEXT);
  const intent = 'organiser-claim';
  const auth = authMode === 'login' ? 'login' : 'register';
  return (
    base +
    '/for-organisers?email=' +
    encodeURIComponent(em) +
    '&intent=' +
    intent +
    '&auth=' +
    auth +
    '&next=' +
    next
  );
}

/**
 * Register/login unless they have already signed in at least once.
 * Email must match the organiser group profile on file.
 * Returns the preview-first URL (for-organisers → set password / sign in).
 */
async function resolveOrganiserClaimUrl(email, host) {
  const em = String(email || '')
    .trim()
    .toLowerCase();
  const base = String(host || '').replace(/\/$/, '');

  const user = await sbAuth.findUserByEmail(em);
  if (!user || !user.lastSignInAt) {
    return previewClaimUrl(base, em, 'register');
  }

  return previewClaimUrl(base, em, 'login');
}

/** Direct auth URL after they have read /for-organisers (used by the page CTA). */
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
  authClaimUrl,
};
