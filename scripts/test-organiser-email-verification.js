#!/usr/bin/env node
/**
 * Email verification URL helpers used at signup and organiser payouts.
 * In-app redirects must not include the confirmation code: the verify page
 * submits ?code= on load and would mark the address confirmed without the user.
 */
const assert = require('assert');
const {
  buildOrganiserVerifyEmailPath,
  verifyEmailPagePath,
  buildEmailVerifyRedirect,
} = require('../api/_lib/organiser-email-verify-paths');

const path = buildOrganiserVerifyEmailPath('482917', 'Organiser@Example.com');
assert.match(path, /^\/organiser\/verify-email\?code=482917&email=/);
assert(path.includes('organiser%40example.com'), 'email should be normalised and encoded');

const codeOnly = buildOrganiserVerifyEmailPath('000001', '');
assert.equal(codeOnly, '/organiser/verify-email?code=000001');

const page = verifyEmailPagePath('New@Example.com');
assert.equal(page, '/organiser/verify-email?email=new%40example.com');
assert.doesNotMatch(page, /code=/);
assert.doesNotMatch(page, /token=/);

const signup = buildEmailVerifyRedirect({
  next: '/welcome',
  code: '482917',
  email: 'new@example.com',
});
assert.doesNotMatch(signup, /code=/);
assert.doesNotMatch(signup, /482917/);
assert.match(signup, /email=new%40example.com/);
assert(signup.includes(encodeURIComponent('/welcome')));

const noCode = buildEmailVerifyRedirect({ next: '/organiser/', email: 'a@b.com' });
assert.equal(noCode, '/organiser/verify-email?email=a%40b.com&next=%2Forganiser%2F');

console.log('OK  organiser email verification paths');
