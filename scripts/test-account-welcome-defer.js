#!/usr/bin/env node
/**
 * Account welcome must not precede confirm-your-email at signup.
 * Register defers welcome (after_verify); verify sends it once.
 * Pending-claim bootstrap must not mark the email confirmed.
 * The confirm page must not auto-submit URL secrets on load.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const registerSrc = fs.readFileSync(
  path.join(__dirname, '../api/_lib/routes/auth-register.js'),
  'utf8'
);
const verifySrc = fs.readFileSync(
  path.join(__dirname, '../api/_lib/routes/auth-verify-organiser-email.js'),
  'utf8'
);
const accountEmailsSrc = fs.readFileSync(
  path.join(__dirname, '../api/_lib/account-emails.js'),
  'utf8'
);
const claimsSrc = fs.readFileSync(
  path.join(__dirname, '../api/_lib/supabase-organiser-claims.js'),
  'utf8'
);
const verifyPageSrc = fs.readFileSync(
  path.join(__dirname, '../js/organiser-verify-email.js'),
  'utf8'
);

assert.match(
  registerSrc,
  /ACCOUNT_WELCOME_AFTER_VERIFY/,
  'register should defer welcome with after_verify policy'
);
assert.match(
  registerSrc,
  /sendOrganiserEmailVerification/,
  'register should still send confirm-your-email'
);

const verifyCall = registerSrc.indexOf('await sendOrganiserEmailVerification');
const welcomeCall = registerSrc.indexOf('await sendAccountWelcomeEmail');
assert(verifyCall !== -1, 'register must call sendOrganiserEmailVerification');
assert(welcomeCall !== -1, 'register must still send welcome when verify is not required');
assert(
  verifyCall < welcomeCall,
  'confirm-your-email call must appear before welcome send in register'
);

assert.match(
  verifySrc,
  /maybeSendDeferredAccountWelcome/,
  'verify route should send deferred welcome after confirmation'
);

assert.match(accountEmailsSrc, /ACCOUNT_WELCOME_AFTER_VERIFY/);
assert.match(accountEmailsSrc, /async function maybeSendDeferredAccountWelcome/);
assert.match(accountEmailsSrc, /async function setAccountWelcomePolicy/);
assert.match(
  accountEmailsSrc,
  /organiser_email_verified_at/,
  'deferred welcome must require hub email confirmation'
);
assert.match(
  accountEmailsSrc,
  /email_not_verified/,
  'deferred welcome should skip when hub is not confirmed'
);

assert.match(
  claimsSrc,
  /async function bootstrapOrganiserFromPendingClaims/,
  'pending-claim bootstrap helper must exist'
);
assert.doesNotMatch(
  claimsSrc,
  /organiser_email_verified_at:\s*hub\?\.organiser_email_verified_at\s*\|\|\s*now/,
  'pending-claim bootstrap must not auto-confirm the email'
);
assert.match(
  claimsSrc,
  /Do not set organiser_email_verified_at/,
  'bootstrap should document that inbox confirmation is still required'
);

assert.doesNotMatch(
  verifyPageSrc,
  /await verifyToken\(legacyToken\)/,
  'confirm page must not auto-submit URL tokens on load'
);
assert.match(
  verifyPageSrc,
  /Never auto-submit/,
  'confirm page should scrub URL secrets instead of confirming'
);

console.log('OK  account welcome deferred until email confirm');
