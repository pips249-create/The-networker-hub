/**
 * URL helpers for organiser / account email confirmation.
 *
 * /organiser/verify-email treats ?code= and ?token= as magic links and confirms
 * the address immediately. Those secrets belong in the email only.
 * In-app redirects after signup, login, or enable must not include them.
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

function destinationPath(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = /^https?:\/\//i.test(raw) ? new URL(raw) : new URL(raw, 'https://example.com');
    return url.pathname || '';
  } catch {
    return raw.split('?')[0].split('#')[0];
  }
}

function isVerifyEmailDestination(value) {
  return /^\/organiser\/verify-email\/?$/.test(destinationPath(value));
}

function nextParamFrom(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = /^https?:\/\//i.test(raw) ? new URL(raw) : new URL(raw, 'https://example.com');
    return String(url.searchParams.get('next') || '').trim();
  } catch {
    return '';
  }
}

/**
 * Login destination for someone who has not entered their confirmation code.
 * Returns null when they are already confirmed, so sign-in keeps its normal page.
 */
function unverifiedAccountLoginRedirect({ verified, redirect, email, fallbackNext } = {}) {
  if (verified) return null;
  let destination = String(redirect || '').trim() || '/events/';
  if (isVerifyEmailDestination(destination)) {
    const nested = nextParamFrom(destination);
    const fallback = String(fallbackNext || '').trim();
    destination =
      (nested && !isVerifyEmailDestination(nested) ? nested : '') ||
      (fallback && !isVerifyEmailDestination(fallback) ? fallback : '') ||
      '/welcome';
  }
  return buildEmailVerifyRedirect({ next: destination, email });
}

module.exports = {
  buildOrganiserVerifyEmailPath,
  verifyEmailPagePath,
  buildEmailVerifyRedirect,
  isVerifyEmailDestination,
  unverifiedAccountLoginRedirect,
};
