#!/usr/bin/env node
/**
 * "Your opportunity is live" sends once, when the listing first goes live.
 * Monthly subscription payments must not send it again.
 * Run: node scripts/test-opportunity-live-email-dedupe.js
 */
const {
  shouldSendOpportunityListingLiveEmail,
} = require('../api/_lib/opportunity-listing-pricing');

let failed = 0;

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

const approvedUnpaid = {
  approval_status: 'Approved',
  status: 'draft',
  listing_paid_at: null,
  published_at: null,
};

assert(
  'first payment after approval sends the live email',
  shouldSendOpportunityListingLiveEmail(approvedUnpaid) === true
);

assert(
  'monthly renewal does not send the live email',
  shouldSendOpportunityListingLiveEmail({
    approval_status: 'Approved',
    status: 'published',
    listing_paid_at: '2026-08-01T00:00:00.000Z',
    listing_expires_at: '2026-09-01T00:00:00.000Z',
    published_at: '2026-08-01T00:00:00.000Z',
  }) === false
);

assert(
  'lapsed month still does not send the live email',
  shouldSendOpportunityListingLiveEmail({
    approval_status: 'Approved',
    status: 'published',
    listing_paid_at: '2026-08-01T00:00:00.000Z',
    listing_expires_at: '2020-01-01T00:00:00.000Z',
    published_at: '2026-08-01T00:00:00.000Z',
  }) === false
);

assert(
  'already published listing does not send on a later payment',
  shouldSendOpportunityListingLiveEmail({
    approval_status: 'Approved',
    status: 'published',
    listing_paid_at: null,
    published_at: '2026-08-01T00:00:00.000Z',
  }) === false
);

assert(
  'payment before approval does not send the live email',
  shouldSendOpportunityListingLiveEmail({
    approval_status: 'Pending Review',
    status: 'draft',
    listing_paid_at: null,
    published_at: null,
  }) === false
);

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('opportunity live email checks passed');
