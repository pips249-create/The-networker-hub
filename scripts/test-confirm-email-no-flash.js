#!/usr/bin/env node
/**
 * REGRESSION LOCK — confirm-email must not flash the code screen then bounce
 * signed-out people to a bare login page (Glenn / Outlook report).
 *
 * History of partial fixes that left the flash in place:
 *   #251 prefill code, still auto-bounced signed-out visitors
 *   #281 preserve code through login, still opened verify page first
 *   #284 skip organiser-intent resend after login
 *
 * This file fails loudly if anyone reintroduces:
 *   1) Inbox CTA → /organiser/verify-email?code=… (must be /login?next=…)
 *   2) Confirm page auto-redirect to /login on missing session
 *   3) Login wiping confirm recovery next / missing confirm callout
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  buildOrganiserVerifyEmailPath,
  buildOrganiserVerifyEmailInboxCta,
  parseVerifyEmailPath,
} = require('../api/_lib/organiser-email-verify-paths');

const inboxCta = buildOrganiserVerifyEmailInboxCta('482917', 'Glenn@Example.com');
assert.match(
  inboxCta,
  /^\/login\?/,
  'REGRESSION: inbox Confirm button must open /login first (not the code form)'
);
assert.match(
  inboxCta,
  /next=/,
  'REGRESSION: inbox CTA must carry next= through to confirm after sign-in'
);
assert.match(
  inboxCta,
  /code%3D482917|code=482917/,
  'REGRESSION: inbox CTA must preserve the 6-digit code inside next='
);
assert.match(
  inboxCta,
  /email=glenn%40example.com/,
  'REGRESSION: inbox CTA must prefill the same email on login'
);
assert.doesNotMatch(
  inboxCta,
  /^\/organiser\/verify-email/,
  'REGRESSION: inbox CTA must NOT land on /organiser/verify-email (that caused the flash)'
);

const nested = new URLSearchParams(inboxCta.slice(inboxCta.indexOf('?') + 1));
const nextPath = nested.get('next') || '';
const parsed = parseVerifyEmailPath(nextPath);
assert.equal(parsed && parsed.code, '482917', 'next= must parse as verify-email with code');
assert.equal(parsed && parsed.email, 'glenn@example.com');

// Confirm path helper still builds the destination login recovers into.
const confirmPath = buildOrganiserVerifyEmailPath('482917', 'glenn@example.com');
assert.equal(confirmPath, '/organiser/verify-email?code=482917&email=glenn%40example.com');

const verifyJs = fs.readFileSync(
  path.join(__dirname, '../js/organiser-verify-email.js'),
  'utf8'
);
assert.match(
  verifyJs,
  /Stay on this page when signed out|showSignedOutUi/,
  'REGRESSION: confirm page must keep the code screen when signed out'
);
assert.doesNotMatch(
  verifyJs,
  /window\.location\.(href|replace)\s*=\s*['"`]\/login\?next=['"`]\s*\+\s*encodeURIComponent\(\s*(returnTo|window\.location)/,
  'REGRESSION: confirm page must not auto-bounce signed-out visitors to /login'
);
assert.match(
  verifyJs,
  /Sign in to confirm/,
  'REGRESSION: signed-out CTA must be an explicit Sign in to confirm action'
);

const authJs = fs.readFileSync(path.join(__dirname, '../js/auth.js'), 'utf8');
assert.match(
  authJs,
  /applyConfirmEmailContext/,
  'REGRESSION: login must show Confirm your email callout for inbox recovery'
);
assert.match(
  authJs,
  /verifyRecovery/,
  'REGRESSION: audience toggle must not wipe confirm-email next= (drops the code)'
);

const sendSrc = fs.readFileSync(
  path.join(__dirname, '../api/_lib/organiser-email-verification.js'),
  'utf8'
);
assert.match(
  sendSrc,
  /buildOrganiserVerifyEmailInboxCta\(code,\s*address\)/,
  'REGRESSION: confirm emails must use the login-first inbox CTA builder'
);
assert.doesNotMatch(
  sendSrc,
  /verifyUrl\s*=\s*siteHost\(\)\s*\+\s*buildOrganiserVerifyEmailPath/,
  'REGRESSION: confirm emails must not point verify_url at the bare confirm page'
);

console.log('OK  confirm-email no-flash regression lock');
