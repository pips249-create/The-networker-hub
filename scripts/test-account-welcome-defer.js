#!/usr/bin/env node
/**
 * Account welcome must not precede confirm-your-email at signup.
 * Register defers welcome (after_verify); verify sends it once.
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

console.log('OK  account welcome deferred until email confirm');
