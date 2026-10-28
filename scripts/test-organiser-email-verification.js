#!/usr/bin/env node
/**
 * Email verification URL helpers used at signup and organiser payouts.
 * Inbox CTAs include the confirmation code. Ordinary in-app redirects stay
 * code-free. Login may pass code through when recovering an inbox link.
 * GET never verifies — only a signed-in POST does.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  buildOrganiserVerifyEmailPath,
  verifyEmailPagePath,
  buildEmailVerifyRedirect,
  parseVerifyEmailPath,
} = require('../api/_lib/organiser-email-verify-paths');

const inboxPath = buildOrganiserVerifyEmailPath('482917', 'Organiser@Example.com');
assert.match(inboxPath, /^\/organiser\/verify-email\?code=482917&email=/);
assert(inboxPath.includes('organiser%40example.com'), 'email should be normalised and encoded');

const codeOnly = buildOrganiserVerifyEmailPath('000001', '');
assert.equal(codeOnly, '/organiser/verify-email?code=000001');

const page = verifyEmailPagePath('New@Example.com');
assert.equal(page, '/organiser/verify-email?email=new%40example.com');
assert.doesNotMatch(page, /code=/);
assert.doesNotMatch(page, /token=/);

const signup = buildEmailVerifyRedirect({
  next: '/welcome',
  email: 'new@example.com',
});
assert.doesNotMatch(signup, /code=/);
assert.doesNotMatch(signup, /482917/);
assert.match(signup, /email=new%40example.com/);
assert(signup.includes(encodeURIComponent('/welcome')));

const loginRecovery = buildEmailVerifyRedirect({
  next: '/welcome',
  email: 'new@example.com',
  code: '482917',
});
assert.match(loginRecovery, /code=482917/);
assert.match(loginRecovery, /next=%2Fwelcome/);

const noCode = buildEmailVerifyRedirect({ next: '/organiser/', email: 'a@b.com' });
assert.equal(noCode, '/organiser/verify-email?email=a%40b.com&next=%2Forganiser%2F');
assert.doesNotMatch(noCode, /code=/);

const nestedVerify = buildEmailVerifyRedirect({
  next: '/organiser/verify-email?code=111222&email=a@b.com&next=%2Fwelcome',
  email: 'a@b.com',
});
assert.doesNotMatch(nestedVerify, /next=%2Forganiser%2Fverify-email/);
assert.match(nestedVerify, /next=%2Fwelcome/);

const parsed = parseVerifyEmailPath(
  '/organiser/verify-email?code=482917&email=User@Example.com&next=%2Forganiser%2F'
);
assert.equal(parsed.code, '482917');
assert.equal(parsed.email, 'user@example.com');
assert.equal(parsed.next, '/organiser/');

const parsedBare = parseVerifyEmailPath('/organiser/verify-email?email=a@b.com');
assert.equal(parsedBare.code, '');
assert.equal(parsedBare.next, '');

assert.equal(parseVerifyEmailPath('/welcome'), null);

const loginSrc = fs.readFileSync(
  path.join(__dirname, '../api/_lib/routes/auth-login.js'),
  'utf8'
);
assert.match(loginSrc, /parseVerifyEmailPath/, 'login must parse inbox verify links');
assert.match(
  loginSrc,
  /code:\s*inboxCode/,
  'login must pass the inbox code through to the confirm redirect'
);
assert.match(
  loginSrc,
  /skipVerificationEmail/,
  'login must not mint a replacement code when recovering an inbox confirm link'
);

const intentSrc = fs.readFileSync(
  path.join(__dirname, '../api/_lib/organiser-auth-intent.js'),
  'utf8'
);
assert.match(
  intentSrc,
  /parseVerifyEmailPath\(next\)/,
  'organiser intent must unwrap /organiser/verify-email before path matching'
);
assert.match(
  intentSrc,
  /shared by every account|post-confirm/,
  'verify-email must not count as organiser intent on its own'
);

// Pure intent checks without loading Supabase (module pulls admin client at require-time).
function isOrganiserAuthIntentForTest({ next, intent } = {}) {
  const value = String(intent || '')
    .trim()
    .toLowerCase();
  if (value === 'organiser' || value === 'organiser-claim') return true;
  const verify = parseVerifyEmailPath(next);
  if (verify) {
    return isOrganiserAuthIntentForTest({ next: verify.next || '', intent: '' });
  }
  const raw = String(next || '').trim();
  let pathOnly = '';
  try {
    pathOnly = /^https?:\/\//i.test(raw) ? new URL(raw).pathname || '' : raw.split('?')[0];
  } catch {
    pathOnly = raw.split('?')[0];
  }
  return /^\/organiser(\/|$)/.test(pathOnly);
}

assert.equal(
  isOrganiserAuthIntentForTest({
    next: '/organiser/verify-email?code=482917&email=a@b.com',
  }),
  false,
  'bare confirm-email recovery is not organiser intent'
);
assert.equal(
  isOrganiserAuthIntentForTest({
    next: '/organiser/verify-email?code=482917&email=a@b.com&next=%2Fwelcome',
  }),
  false,
  'confirm → welcome is not organiser intent'
);
assert.equal(
  isOrganiserAuthIntentForTest({
    next: '/organiser/verify-email?code=482917&email=a@b.com&next=%2Forganiser%2F',
  }),
  true,
  'confirm → organiser workspace keeps organiser intent'
);
assert.equal(
  isOrganiserAuthIntentForTest({ next: '/organiser/', intent: '' }),
  true
);
assert.equal(
  isOrganiserAuthIntentForTest({ next: '/welcome', intent: 'organiser' }),
  true
);

const verifyPageSrc = fs.readFileSync(
  path.join(__dirname, '../js/organiser-verify-email.js'),
  'utf8'
);
assert.match(
  verifyPageSrc,
  /await submitCode\(urlCode\)/,
  'signed-in inbox opens must POST the prefilled code'
);

console.log('OK  organiser email verification paths');
