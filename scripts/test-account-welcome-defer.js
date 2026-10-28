#!/usr/bin/env node
/**
 * Account welcome must not precede confirm-your-email at signup.
 * Register never sends welcome; verify sends it once after a typed code.
 * Organiser workspace access is also deferred until that typed code succeeds.
 * Self-serve signup clears staff-provisioned verify flags.
 * Pending-claim bootstrap must not mark the email confirmed or grant access_at.
 * The confirm page prefills inbox codes and finishes via POST once signed in.
 * The organiser auth gate must redirect unverified users to confirm-email.
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
const verificationSrc = fs.readFileSync(
  path.join(__dirname, '../api/_lib/organiser-email-verification.js'),
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
assert.match(
  registerSrc,
  /clearOrganiserEmailVerification/,
  'register must clear staff-provisioned verify flags before confirm'
);
assert.doesNotMatch(
  registerSrc,
  /sendAccountWelcomeEmail/,
  'register must never send the welcome email'
);

const verifyCall = registerSrc.indexOf('await sendOrganiserEmailVerification');
assert(verifyCall !== -1, 'register must call sendOrganiserEmailVerification');

assert.match(
  verifySrc,
  /maybeSendDeferredAccountWelcome/,
  'verify route should send deferred welcome after confirmation'
);
assert.match(
  verifySrc,
  /resolveOrganiserRedirect/,
  'verify route should route claim users after confirm'
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
  accountEmailsSrc,
  /ACCOUNT_WELCOME_SKIP \|\| policy === ACCOUNT_WELCOME_SENT/,
  'deferred welcome should skip only skip/sent policies'
);

assert.match(
  verificationSrc,
  /async function clearOrganiserEmailVerification/,
  'clearOrganiserEmailVerification helper must exist'
);
assert.match(
  verificationSrc,
  /organiser_email_verified_at:\s*null/,
  'storing a fresh confirm code must clear organiser_email_verified_at'
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
  /Do not set organiser_access_at or organiser_email_verified_at/,
  'bootstrap should document that inbox confirmation is still required before access'
);

assert.doesNotMatch(
  verifyPageSrc,
  /await verifyToken\(legacyToken\)/,
  'confirm page must not call verifyToken directly with a legacy token helper'
);
assert.match(
  verifyPageSrc,
  /await submitCode\(urlCode\)/,
  'signed-in inbox opens must POST the prefilled code (GET never verifies)'
);
assert.match(
  verifyPageSrc,
  /mail scanners that GET|without a session never reach here/i,
  'confirm page must document that scanners without a session cannot finish confirm'
);
assert.match(
  verifyPageSrc,
  /codeEl\.value\s*=\s*urlCode/,
  'confirm page should prefill the code from the inbox CTA'
);
assert.match(
  verificationSrc,
  /buildOrganiserVerifyEmailPath\(code,\s*address\)/,
  'confirm email CTA must open the confirm screen with the code prefilled'
);
assert.match(
  verificationSrc,
  /verifyPath:\s*safeVerifyPath/,
  'in-app verifyPath after send must stay code-free'
);

const intentSrc = fs.readFileSync(
  path.join(__dirname, '../api/_lib/organiser-auth-intent.js'),
  'utf8'
);
const resolveFn = intentSrc.slice(
  intentSrc.indexOf('async function resolveOrganiserRedirect'),
  intentSrc.indexOf('async function maybeAutoEnableOrganiserAccess')
);
assert.match(
  resolveFn,
  /if\s*\(\s*!status\.organiserEmailVerified\s*\)/,
  'organiser redirect must require email confirm before claim'
);
assert.ok(
  resolveFn.indexOf('!status.organiserEmailVerified') <
    resolveFn.indexOf('pendingClaimCount'),
  'email confirm check must come before pending-claim redirect'
);

const autoEnableFn = intentSrc.slice(
  intentSrc.indexOf('async function maybeAutoEnableOrganiserAccess'),
  intentSrc.indexOf('async function maybeEnableOrganiserAccessAfterEmailVerify')
);
assert.match(
  autoEnableFn,
  /pendingVerification:\s*true/,
  'auto-enable must defer access until email confirm'
);
assert.match(
  autoEnableFn,
  /setOrganiserAccessPending/,
  'auto-enable must record pending organiser intent while waiting for confirm'
);
assert.ok(
  autoEnableFn.indexOf('!before.organiserEmailVerified') <
    autoEnableFn.indexOf('enableOrganiserAccess'),
  'auto-enable must not call enableOrganiserAccess before email is confirmed'
);

assert.match(
  verifySrc,
  /maybeEnableOrganiserAccessAfterEmailVerify/,
  'verify route must enable organiser access only after the typed code succeeds'
);
assert.ok(
  verifySrc.indexOf('await maybeEnableOrganiserAccessAfterEmailVerify') <
    verifySrc.indexOf('await maybeSendDeferredAccountWelcome'),
  'access enable must run before welcome so both wait on the same confirm'
);

assert.doesNotMatch(
  claimsSrc,
  /organiser_access_at:\s*hub\?\.organiser_access_at\s*\|\|\s*now/,
  'pending-claim bootstrap must not grant organiser_access_at before confirm'
);

const authGateSrc = fs.readFileSync(
  path.join(__dirname, '../js/organiser-auth-gate.js'),
  'utf8'
);
assert.match(
  authGateSrc,
  /organiserEmailVerified\s*!==\s*true/,
  'organiser workspace gate must block unverified users'
);
assert.match(
  authGateSrc,
  /\/organiser\/verify-email/,
  'organiser workspace gate must send unverified users to confirm-email'
);

const provisionSrc = fs.readFileSync(
  path.join(__dirname, '../api/_lib/supabase-auth.js'),
  'utf8'
);
const provisionStart = provisionSrc.indexOf('async function provisionOrganiserLogin');
const provisionFn = provisionSrc.slice(
  provisionStart,
  provisionSrc.indexOf('async function findOrganiserIdsByEmail', provisionStart)
);
assert.doesNotMatch(
  provisionFn,
  /organiser_email_verified_at:\s*now/,
  'provisionOrganiserLogin must not mark the email confirmed without inbox proof'
);

const enableRouteSrc = fs.readFileSync(
  path.join(__dirname, '../api/_lib/routes/auth-organiser-access.js'),
  'utf8'
);
assert.match(
  enableRouteSrc,
  /Confirm your email to enable organiser access/,
  'enable-organiser must require confirm before unlocking access'
);
assert.ok(
  enableRouteSrc.indexOf('!before.organiserEmailVerified') <
    enableRouteSrc.indexOf('await sbAuth.enableOrganiserAccess'),
  'enable-organiser must not call enableOrganiserAccess before email confirm'
);

assert.match(
  resolveFn,
  /return\s*['"]\/welcome['"]/,
  'attendee-only accounts must continue to /welcome after confirm'
);

const attendeeGateSrc = fs.readFileSync(
  path.join(__dirname, '../js/attendee-auth-gate.js'),
  'utf8'
);
assert.match(
  attendeeGateSrc,
  /organiserEmailVerified\s*!==\s*true/,
  'attendee My account gate must block unverified users'
);
assert.match(
  attendeeGateSrc,
  /\/organiser\/verify-email/,
  'attendee My account gate must send unverified users to confirm-email'
);

const welcomeSrc = fs.readFileSync(path.join(__dirname, '../js/welcome.js'), 'utf8');
assert.match(
  welcomeSrc,
  /organiserEmailVerified\s*!==\s*true/,
  'welcome onboarding must require email confirm'
);

const settingsSrc = fs.readFileSync(
  path.join(__dirname, '../js/account-settings.js'),
  'utf8'
);
assert.match(
  settingsSrc,
  /organiserEmailVerified\s*!==\s*true/,
  'account settings must require email confirm'
);

const loginSrc = fs.readFileSync(
  path.join(__dirname, '../api/_lib/routes/auth-login.js'),
  'utf8'
);
assert.match(
  loginSrc,
  /buildEmailVerifyRedirect/,
  'login must send unverified accounts to confirm-email'
);

const attendeeDashSrc = fs.readFileSync(
  path.join(__dirname, '../api/_lib/routes/auth-attendee-dashboard.js'),
  'utf8'
);
assert.match(
  attendeeDashSrc,
  /assertEmailVerified/,
  'attendee dashboard API must require email confirm'
);

const accessGuardSrc = fs.readFileSync(
  path.join(__dirname, '../api/_lib/organiser-access-guard.js'),
  'utf8'
);
assert.match(
  accessGuardSrc,
  /async function assertEmailVerified/,
  'shared assertEmailVerified helper must exist for all account types'
);

console.log('OK  account welcome deferred until email confirm');
