/**
 * URL helpers for organiser / account email confirmation.
 *
 * Inbox CTAs may include ?code= so the confirm page can prefill the digits.
 * In-app redirects must stay code-free. The confirm page must never auto-submit
 * URL secrets on load (mail scanners / premature Welcome).
 */

function buildOrganiserVerifyEmailPath(code, email) {
  const address = String(email || '')
    .trim()
    .toLowerCase();
  let path =
    '/organiser/verify-email?code=' + encodeURIComponent(String(code || '').trim());
  if (address) {
    path += '&email=' + encodeURIComponent(address);
  }
  return path;
}

/** Confirm-email screen with no secret. Safe to put in a browser redirect. */
function verifyEmailPagePath(email) {
  const address = String(email || '')
    .trim()
    .toLowerCase();
  if (!address) return '/organiser/verify-email';
  return '/organiser/verify-email?email=' + encodeURIComponent(address);
}

/**
 * Where to send someone who still needs to confirm.
 * `code` is ignored on purpose: in-app redirects must not carry inbox secrets.
 */
function buildEmailVerifyRedirect({ next, email } = {}) {
  const destination = String(next || '').trim() || '/welcome';
  const params = new URLSearchParams();
  const address = String(email || '')
    .trim()
    .toLowerCase();
  if (address) params.set('email', address);
  params.set('next', destination);
  return '/organiser/verify-email?' + params.toString();
}

module.exports = {
  buildOrganiserVerifyEmailPath,
  verifyEmailPagePath,
  buildEmailVerifyRedirect,
};
