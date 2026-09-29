#!/usr/bin/env node
/**
 * Submitted opportunity listings stay editable so an organiser can change
 * fields and update the same approval submission.
 * Run: node scripts/test-opportunity-review-edit.js
 */
const {
  isOpportunityLockedForOrganiserEdit,
  isOpportunityLockedForOrganiserEditListing,
} = require('../api/_lib/opportunity-review-queue');

let failed = 0;

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

const pendingRow = {
  approval_status: 'Pending Review',
  review_submitted_at: '2026-09-01T12:00:00.000Z',
  meta: [{ key: '__review_submitted_at', val: '2026-09-01T12:00:00.000Z' }],
  pending_review_payload: {
    submittedAt: '2026-09-01T12:00:00.000Z',
    row: { title: 'Existing listing' },
  },
};

assert(
  'pending submission can be edited',
  isOpportunityLockedForOrganiserEdit(pendingRow) === false
);

assert(
  'pending listing can be edited from the organiser form',
  isOpportunityLockedForOrganiserEditListing({
    approvalStatus: 'Pending Review',
    reviewSubmittedAt: '2026-09-01T12:00:00.000Z',
    hasPendingChanges: true,
  }) === false
);

assert(
  'rejected listing can be edited',
  isOpportunityLockedForOrganiserEdit({
    approval_status: 'Rejected',
    review_submitted_at: '2026-09-01T12:00:00.000Z',
  }) === false
);

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('opportunity review edit checks passed');
