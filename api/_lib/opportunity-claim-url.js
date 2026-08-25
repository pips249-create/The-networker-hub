/**
 * Deep-links for business opportunity claim invites.
 * Land on the public listing first, then register/login → organiser claim prompt → Stripe.
 */
const sbAuth = require('./supabase-auth');

const CLAIM_NEXT = '/organiser/?onboard=opportunity-claim';

function encodeNext(path) {
  return encodeURIComponent(String(path || CLAIM_NEXT));
}

function claimQuery(em, authMode) {
  const next = encodeNext(CLAIM_NEXT);
  const intent = 'opportunity-claim';
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

function softPathClaimUrl(base, em, authMode) {
  return String(base || '').replace(/\/$/, '') + '/opportunities/?' + claimQuery(em, authMode);
}

/**
 * Path B — public opportunity listing first.
 * @param {string} base
 * @param {string} em
 * @param {'login'|'register'} authMode
 * @param {string} [slugOrId]
 */
function previewClaimUrl(base, em, authMode, slugOrId) {
  const s = String(slugOrId || '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
  if (!s) return softPathClaimUrl(base, em, authMode);
  return (
    String(base || '').replace(/\/$/, '') +
    '/opportunities/' +
    encodeURIComponent(s) +
    '?' +
    claimQuery(em, authMode)
  );
}

async function resolveOpportunityClaimUrl(email, host, slugOrId) {
  const em = String(email || '')
    .trim()
    .toLowerCase();
  const base = String(host || '').replace(/\/$/, '');
  const resolved = String(slugOrId || '').trim();

  const user = await sbAuth.findUserByEmail(em);
  if (!user || !user.lastSignInAt) {
    return previewClaimUrl(base, em, 'register', resolved);
  }

  return previewClaimUrl(base, em, 'login', resolved);
}

module.exports = {
  CLAIM_NEXT,
  resolveOpportunityClaimUrl,
  previewClaimUrl,
  softPathClaimUrl,
};
