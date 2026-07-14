/**
 * Deep-links for organiser profile claim campaigns.
 * Recipients are group profile emails — most need to create a password, not "sign in".
 */
const sbAuth = require('./supabase-auth');

const CLAIM_NEXT = '/organiser/?onboard=claim';

function encodeNext(path) {
  return encodeURIComponent(String(path || CLAIM_NEXT));
}

/**
 * Register for new accounts; login when a Hub account already exists.
 * Email must match the organiser group profile on file.
 */
async function resolveOrganiserClaimUrl(email, host) {
  const em = String(email || '')
    .trim()
    .toLowerCase();
  const base = String(host || '').replace(/\/$/, '');
  const next = encodeNext(CLAIM_NEXT);
  const intent = 'organiser-claim';

  const user = await sbAuth.findUserByEmail(em);
  if (!user) {
    return (
      base +
      '/register?email=' +
      encodeURIComponent(em) +
      '&next=' +
      next +
      '&intent=' +
      intent
    );
  }

  return (
    base +
    '/login?email=' +
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
};
