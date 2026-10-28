/**
 * URL helpers for organiser / account email confirmation.
 *
 * REGRESSION LOCK (Glenn / inbox drop-off): earlier “fixes” (#251 prefill,
 * #281 preserve-code-through-login, #284 skip organiser-intent resend) still
 * sent signed-out inbox clicks to /organiser/verify-email, which flashed the
 * code form then bounced to a bare login page. Inbox CTAs must open /login
 * with next=/organiser/verify-email?code=… so the first paint is sign-in (with
 * callout). The confirm page itself must never auto-redirect when signed out.
 *
 * In-app redirects stay code-free unless recovering an inbox link through
 * login (see parseVerifyEmailPath + buildEmailVerifyRedirect({ code })).
 * GET never verifies — only POST after a session exists.
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

/**
 * Inbox email button target. Always /login?next=…/verify-email?code=…
 * so signed-out people never see the code screen flash away to a bare login.
 * Signed-in people are forwarded to the confirm page (and auto-submit) by
 * maybeRedirectAuthenticatedLogin.
 */
function buildOrganiserVerifyEmailInboxCta(code, email) {
  const verifyPath = buildOrganiserVerifyEmailPath(code, email);
  const params = new URLSearchParams();
  params.set('next', verifyPath);
  const address = String(email || '')
    .trim()
    .toLowerCase();
  if (address) params.set('email', address);
  return '/login?' + params.toString();
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
  buildOrganiserVerifyEmailInboxCta,
  verifyEmailPagePath,
  buildEmailVerifyRedirect,
  parseVerifyEmailPath,
  normalizeVerifyCode,
};
