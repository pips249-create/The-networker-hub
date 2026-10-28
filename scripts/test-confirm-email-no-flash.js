#!/usr/bin/env node
/**
 * REGRESSION LOCK — confirm-email inbox click must work.
 *
 * Intended UX:
 *   - Email button opens the confirm screen with the code
 *   - Signed-out: screen stays put (no flash to bare login); Sign in preserves code=
 *   - Signed-in (or after sign-in): inbox code is POSTed so the link finishes
 *   - Without a code in the URL, people type digits and tap Confirm
 *
 * Also: asset paths must be root-absolute. A trailing slash on
 * /organiser/verify-email/ used to resolve ../js/ → /organiser/js/ (404),
 * leaving a dead form where Confirm did nothing.
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
  /await submitCode\(urlCode\)/,
  'REGRESSION: signed-in inbox opens must POST the code so the email button finishes'
);
assert.match(
  verifyJs,
  /hideContinueUntilVerified/,
  'REGRESSION: Continue must stay hidden until the code succeeds (no dual CTAs)'
);

const verifyHtml = fs.readFileSync(
  path.join(__dirname, '../organiser/verify-email.html'),
  'utf8'
);
assert.match(
  verifyHtml,
  /src="\/js\/organiser-verify-email\.js/,
  'REGRESSION: confirm page JS must be root-absolute (/js/…) so trailing-slash URLs still load it'
);
assert.match(
  verifyHtml,
  /href="\/css\/organiser-enable\.css/,
  'REGRESSION: confirm page CSS must be root-absolute'
);
assert.doesNotMatch(
  verifyHtml,
  /src="\.\.\/js\/organiser-verify-email/,
  'REGRESSION: relative ../js breaks when /organiser/verify-email/ has a trailing slash'
);
assert.match(
  verifyHtml,
  /id="verify-email-continue"[\s\S]*style="display:\s*none"/,
  'REGRESSION: Continue link must start display:none so CSS cannot show it early'
);

const vercel = fs.readFileSync(path.join(__dirname, '../vercel.json'), 'utf8');
assert.match(
  vercel,
  /\/organiser\/verify-email\/[\s\S]*\/organiser\/verify-email/,
  'REGRESSION: trailing-slash confirm URL should rewrite to the slashless path'
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

console.log('OK  confirm-email inbox-click regression lock');
