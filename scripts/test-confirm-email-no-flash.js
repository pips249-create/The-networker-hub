#!/usr/bin/env node
/**
 * REGRESSION LOCK — confirm-email typed flow.
 *
 * Intended UX: receive code → confirm screen → type/confirm code → continue.
 *
 * Must not:
 *   1) Auto-bounce signed-out visitors off the code screen to a bare login
 *   2) Auto-submit the inbox code on page load (people must tap Confirm)
 *   3) Drop code= when recovering through login / wiping next= on audience toggle
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  buildOrganiserVerifyEmailPath,
  parseVerifyEmailPath,
} = require('../api/_lib/organiser-email-verify-paths');

const inboxPath = buildOrganiserVerifyEmailPath('482917', 'Glenn@Example.com');
assert.match(
  inboxPath,
  /^\/organiser\/verify-email\?code=482917&email=glenn%40example.com$/,
  'REGRESSION: inbox Confirm button must open the confirm screen with the code'
);
assert.doesNotMatch(
  inboxPath,
  /^\/login/,
  'REGRESSION: inbox CTA must land on the confirm screen (people type the code there)'
);

const parsed = parseVerifyEmailPath(inboxPath);
assert.equal(parsed.code, '482917');
assert.equal(parsed.email, 'glenn@example.com');

const verifyJs = fs.readFileSync(
  path.join(__dirname, '../js/organiser-verify-email.js'),
  'utf8'
);
assert.match(
  verifyJs,
  /showSignedOutUi|Stay on this page when signed out/,
  'REGRESSION: confirm page must keep the code screen when signed out'
);
assert.doesNotMatch(
  verifyJs,
  /window\.location\.(href|replace)\s*=\s*['"`]\/login\?next=['"`]\s*\+\s*encodeURIComponent\(\s*(returnTo|window\.location)/,
  'REGRESSION: confirm page must not auto-bounce signed-out visitors to /login'
);
assert.match(
  verifyJs,
  /never auto-submit|Prefill from the inbox CTA/,
  'REGRESSION: inbox opens must prefill but not auto-submit — people tap Confirm'
);
assert.doesNotMatch(
  verifyJs,
  /await submitCode\(urlCode\)/,
  'REGRESSION: must not auto-POST the inbox code on load'
);
assert.match(
  verifyJs,
  /Code ready — tap Confirm your email to finish/,
  'REGRESSION: signed-in prefill must ask them to tap Confirm'
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
  /buildOrganiserVerifyEmailPath\(code,\s*address\)/,
  'REGRESSION: confirm emails must link to the confirm screen with the code'
);

console.log('OK  confirm-email typed-flow regression lock');
