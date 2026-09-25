#!/usr/bin/env node
/**
 * The listing-rejected email waits for an admin deny.
 * Automated red-flag rejection must not send it.
 * Run: node scripts/test-opportunity-rejection-email.js
 */
const { shouldEmailOpportunityRejection } = require('../api/_lib/opportunity-review-queue');

let failed = 0;

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

assert('admin reject sends the email', shouldEmailOpportunityRejection() === true);
assert(
  'admin reject with an explicit send still emails',
  shouldEmailOpportunityRejection({ sendEmail: true }) === true
);
assert(
  'automated red-flag rejection does not email',
  shouldEmailOpportunityRejection({ automated: true }) === false
);
assert(
  'automated rejection stays silent even if sendEmail is left on',
  shouldEmailOpportunityRejection({ automated: true, sendEmail: true }) === false
);
assert(
  'explicit sendEmail false does not email',
  shouldEmailOpportunityRejection({ sendEmail: false }) === false
);

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('opportunity rejection email checks passed');
