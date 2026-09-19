#!/usr/bin/env node
/**
 * Email verification URL helpers used at signup and organiser payouts.
 */
const assert = require('assert');

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

function buildEmailVerifyRedirect({ next, code, email } = {}) {
  const destination = String(next || '').trim() || '/welcome';
  if (code) {
    let path = buildOrganiserVerifyEmailPath(code, email);
    path +=
      (path.indexOf('?') >= 0 ? '&' : '?') + 'next=' + encodeURIComponent(destination);
    return path;
  }
  const params = new URLSearchParams();
  if (email) params.set('email', String(email).trim().toLowerCase());
  params.set('next', destination);
  return '/organiser/verify-email?' + params.toString();
}

const path = buildOrganiserVerifyEmailPath('482917', 'Organiser@Example.com');
assert.match(path, /^\/organiser\/verify-email\?code=482917&email=/);
assert(path.includes('organiser%40example.com'), 'email should be normalised and encoded');

const codeOnly = buildOrganiserVerifyEmailPath('000001', '');
assert.equal(codeOnly, '/organiser/verify-email?code=000001');

const signup = buildEmailVerifyRedirect({
  next: '/welcome',
  code: '482917',
  email: 'new@example.com',
});
assert.match(signup, /^\/organiser\/verify-email\?code=482917&email=new%40example.com&next=/);
assert(signup.includes(encodeURIComponent('/welcome')));

const noCode = buildEmailVerifyRedirect({ next: '/organiser/', email: 'a@b.com' });
assert.equal(noCode, '/organiser/verify-email?email=a%40b.com&next=%2Forganiser%2F');

console.log('OK  organiser email verification paths');
