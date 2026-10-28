/**
 * URL helpers for organiser / account email confirmation.
 *
 * Intended UX: email shows a 6-digit code → confirm screen → person types (or
 * confirms a prefill) → then they can continue. GET never verifies.
 *
 * REGRESSION LOCK: signed-out inbox opens must NOT flash the code form then
 * bounce to a bare login (#251/#281/#284 left that bounce in place). The
 * confirm page stays put; Sign in preserves code= in ?next=; after login they
 * still tap Confirm (no auto-submit).
 *
 * In-app redirects stay code-free unless recovering an inbox link through
 * login (see parseVerifyEmailPath + buildEmailVerifyRedirect({ code })).
 */

function organiserPathOnly(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  try {
    if (/^https?:\/\//i.test(value)) return new URL(value).pathname || '';
    return value.split('?')[0].split('#')[0];
  } catch {
    return value.split('?')[0].split('#')[0];
  }
}

function normalizeVerifyCode(raw) {
  return String(raw || '')
    .replace(/\D/g, '')
    .slice(0, 6);
}

/**
 * Parse /organiser/verify-email URLs (inbox CTA or login ?next=).
 * Returns null when the path is not the confirm page.
 */
function parseVerifyEmailPath(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  try {
    const url = /^https?:\/\//i.test(value)
      ? new URL(value)
      : new URL(value, 'https://example.com');
    if (!/^\/organiser\/verify-email(?:\.html)?\/?$/.test(url.pathname)) return null;
    const digits = normalizeVerifyCode(
      url.searchParams.get('code') || url.searchParams.get('token') || ''
    );
    const email = String(url.searchParams.get('email') || '')
      .trim()
      .toLowerCase();
    let next = String(url.searchParams.get('next') || '').trim();
    if (next && /^\/organiser\/verify-email(?:\.html)?\/?$/.test(organiserPathOnly(next))) {
      next = '';
    }
    return {
      code: digits.length === 6 ? digits : '',
      email,
      next,
    };
  } catch {
    return null;
  }
}

function buildOrganiserVerifyEmailPath(code, email) {
  const address = String(email || '')
    .trim()
    .toLowerCase();
  const digits = normalizeVerifyCode(code);
  let path = '/organiser/verify-email';
  const params = new URLSearchParams();
  if (digits.length === 6) params.set('code', digits);
  if (address) params.set('email', address);
  const query = params.toString();
  if (query) path += '?' + query;
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
 * Pass `code` only when recovering an inbox link through login — ordinary
 * in-app redirects must omit it.
 */
function buildEmailVerifyRedirect({ next, email, code } = {}) {
  let destination = String(next || '').trim() || '/welcome';
  if (/^\/organiser\/verify-email(?:\.html)?\/?$/.test(organiserPathOnly(destination))) {
    const nested = parseVerifyEmailPath(destination);
    destination = (nested && nested.next) || '/welcome';
  }
  if (/^\/organiser\/verify-email(?:\.html)?\/?$/.test(organiserPathOnly(destination))) {
    destination = '/welcome';
  }
  const params = new URLSearchParams();
  const address = String(email || '')
    .trim()
    .toLowerCase();
  if (address) params.set('email', address);
  const digits = normalizeVerifyCode(code);
  if (digits.length === 6) params.set('code', digits);
  params.set('next', destination);
  return '/organiser/verify-email?' + params.toString();
}

module.exports = {
  buildOrganiserVerifyEmailPath,
  verifyEmailPagePath,
  buildEmailVerifyRedirect,
  parseVerifyEmailPath,
  normalizeVerifyCode,
};
