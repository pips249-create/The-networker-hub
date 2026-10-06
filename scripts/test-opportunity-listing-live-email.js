#!/usr/bin/env node
/**
 * "Your opportunity is live" goes out the first time an approved listing is paid.
 * A later subscription payment must not send it again.
 * Run: node scripts/test-opportunity-listing-live-email.js
 */
const {
  shouldSendOpportunityListingLiveEmail,
  listingActivationAlreadyApplied,
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

const future = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const later = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString();

const firstPayment = {
  approval_status: 'Approved',
  status: 'draft',
  listing_paid_at: null,
  listing_expires_at: null,
  published_at: null,
};

assert(
  'first payment on an approved listing sends the live email',
  shouldSendOpportunityListingLiveEmail(firstPayment, {
    ...firstPayment,
    status: 'published',
    approval_status: 'Approved',
  }) === true
);

assert(
  'payment while still pending review does not send it',
  shouldSendOpportunityListingLiveEmail(
    { ...firstPayment, approval_status: 'Pending Review' },
    { ...firstPayment, approval_status: 'Pending Review', status: 'published' }
  ) === false
);

const renewal = {
  approval_status: 'Approved',
  status: 'published',
  listing_paid_at: '2026-09-06T08:00:00.000Z',
  listing_expires_at: past,
  published_at: '2026-09-06T08:00:00.000Z',
  listing_stripe_session_id: 'cs_test_original',
};

assert(
  'a renewal after the previous term ended does not send the live email',
  shouldSendOpportunityListingLiveEmail(renewal, renewal) === false
);

assert(
  'a renewal while the current term is still active does not send the live email',
  shouldSendOpportunityListingLiveEmail(
    { ...renewal, listing_expires_at: future },
    { ...renewal, listing_expires_at: later }
  ) === false
);

assert(
  'a legacy listing that is already public does not get the live email on first recorded payment',
  shouldSendOpportunityListingLiveEmail(
    {
      approval_status: 'Approved',
      status: 'published',
      listing_paid_at: null,
      listing_expires_at: null,
      published_at: '2026-01-01T00:00:00.000Z',
    },
    {
      approval_status: 'Approved',
      status: 'published',
    }
  ) === false
);

assert(
  'stripe retry of the same period does not re-activate',
  listingActivationAlreadyApplied(
    { ...renewal, listing_expires_at: future },
    { sessionId: 'cs_test_original', periodEndIso: future }
  ) === true
);

assert(
  'a renewal with a later period end still updates the term',
  listingActivationAlreadyApplied(
    { ...renewal, listing_expires_at: future },
    { sessionId: 'cs_test_original', periodEndIso: later }
  ) === false
);

assert(
  'a renewal after expiry is not treated as an already-applied charge',
  listingActivationAlreadyApplied(renewal, {
    sessionId: 'cs_test_original',
    periodEndIso: later,
  }) === false
);

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('opportunity listing live email checks passed');
