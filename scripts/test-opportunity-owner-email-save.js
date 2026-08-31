#!/usr/bin/env node
/**
 * Unit tests — admin Save listing owner/claimant email patch.
 */
const {
  HUB_SEED_OWNER_EMAIL,
  buildOwnerEmailSavePatch,
} = require('../api/_lib/opportunity-hub-seed');

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL:', label);
    process.exitCode = 1;
    return;
  }
  console.log('OK:', label);
}

const fromHub = buildOwnerEmailSavePatch('claimant@brand.co.uk', HUB_SEED_OWNER_EMAIL);
assert('Sets claimant email', fromHub.owner_email === 'claimant@brand.co.uk');
assert('Pending claim when leaving hub', fromHub.ownership_claim_status === 'pending');
assert('Clears supabase user on change', fromHub.supabase_user_id === null);

const blank = buildOwnerEmailSavePatch('', 'claimant@brand.co.uk');
assert('Blank returns hub seed', blank.owner_email === HUB_SEED_OWNER_EMAIL);
assert('Blank clears claim status', blank.ownership_claim_status === null);

const sameClaimed = buildOwnerEmailSavePatch('claimant@brand.co.uk', 'claimant@brand.co.uk');
assert('Same claimant keeps only owner_email', Object.keys(sameClaimed).join(',') === 'owner_email');

const sameHub = buildOwnerEmailSavePatch(HUB_SEED_OWNER_EMAIL, HUB_SEED_OWNER_EMAIL);
assert('Same hub seed clears claim status', sameHub.ownership_claim_status === null);

let invalid = null;
try {
  buildOwnerEmailSavePatch('not-an-email', HUB_SEED_OWNER_EMAIL);
} catch (e) {
  invalid = e;
}
assert('Invalid email throws', invalid && invalid.code === 'invalid_owner_email');

if (process.exitCode) {
  console.error('opportunity owner email save tests failed');
  process.exit(1);
}
console.log('All opportunity owner email save tests passed');
