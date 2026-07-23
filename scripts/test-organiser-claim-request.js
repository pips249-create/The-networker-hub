#!/usr/bin/env node
/**
 * Unit checks for organiser claim request eligibility.
 * Usage: node scripts/test-organiser-claim-request.js
 */
const { isOrganiserClaimableRow } = require('../api/_lib/organiser-claim-request');

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL:', label);
    process.exitCode = 1;
    return false;
  }
  return true;
}

const publishedUnclaimed = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Test Group',
  verification_status: 'Verified',
  listing_status: 'published',
  ownership_claim_status: 'pending',
};

const claimed = { ...publishedUnclaimed, ownership_claim_status: 'claimed' };
const disputed = { ...publishedUnclaimed, ownership_claim_status: 'disputed' };
const draft = { ...publishedUnclaimed, listing_status: 'draft', verification_status: 'Unverified' };

assert('pending published profile is claimable', isOrganiserClaimableRow(publishedUnclaimed));
assert('disputed profile remains claimable via request', isOrganiserClaimableRow(disputed));
assert('claimed profile is not claimable', !isOrganiserClaimableRow(claimed));
assert('unpublished unverified profile is not claimable', !isOrganiserClaimableRow(draft));
assert('missing name is not claimable', !isOrganiserClaimableRow({ ...publishedUnclaimed, name: '' }));

if (!process.exitCode) {
  console.log('All organiser claim request checks passed');
}
