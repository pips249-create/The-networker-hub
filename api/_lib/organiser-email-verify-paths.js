/**
 * URL helpers for organiser / account email confirmation.
 *
 * The confirm page requires the user to type the 6-digit code. Do not put
 * ?code= or ?token= on in-app redirects — those secrets belong in the email only
 * (and URL secrets must not auto-confirm on page load).
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
 * Where to send someone who still needs to enter the code.
 * `code` is ignored on purpose: passing it used to auto-confirm the email.
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
