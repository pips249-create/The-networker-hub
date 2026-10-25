/**
 * Offline check: Stripe Connect bank-details nudges skip unclaimed organiser pages.
 *
 *   node scripts/test-stripe-connect-nudge-claim-gate.js
 */
const assert = require('assert');
const path = require('path');

const src = require('fs').readFileSync(
  path.join(__dirname, '../api/_lib/engagement-emails.js'),
  'utf8'
);

const fnStart = src.indexOf('async function sendDueStripeConnectNudges');
assert.ok(fnStart >= 0, 'sendDueStripeConnectNudges must exist');
const fnEnd = src.indexOf('\nasync function ', fnStart + 1);
const fnBody = src.slice(fnStart, fnEnd > fnStart ? fnEnd : undefined);

assert.match(
  fnBody,
  /\.eq\(\s*['"]ownership_claim_status['"]\s*,\s*['"]claimed['"]\s*\)/,
  'must filter organisers to ownership_claim_status = claimed'
);
assert.match(
  fnBody,
  /ownership_claim_status/,
  'must select / check ownership_claim_status'
);
assert.doesNotMatch(
  fnBody,
  /ownership_claim_status\.is\.null/,
  'must not include null / pending claim statuses'
);

console.log('ok — stripe connect nudge gated to claimed organiser pages');
