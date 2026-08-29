#!/usr/bin/env node
/**
 * Unit checks for Premium Spotlight opportunity slot eligibility.
 * Run: node scripts/test-opportunity-spotlight-slots.js
 */
const { isPremiumSpotlightActiveRow } = require('../api/_lib/opportunity-premium-slots');

let failed = 0;

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

assert(
  'counts approved published paid featured',
  isPremiumSpotlightActiveRow({
    featured: true,
    status: 'published',
    approval_status: 'Approved',
    listing_paid_at: '2026-08-01T00:00:00.000Z',
    listing_expires_at: future,
    type: 'franchise',
  }) === true
);

assert(
  'excludes network-marketing type',
  isPremiumSpotlightActiveRow({
    featured: true,
    status: 'published',
    approval_status: 'Approved',
    listing_paid_at: '2026-08-01T00:00:00.000Z',
    listing_expires_at: future,
    type: 'network-marketing',
  }) === false
);

assert(
  'excludes network-marketing tag',
  isPremiumSpotlightActiveRow({
    featured: true,
    status: 'published',
    approval_status: 'Approved',
    listing_paid_at: '2026-08-01T00:00:00.000Z',
    listing_expires_at: future,
    type: 'franchise',
    tags: ['franchise', 'network-marketing'],
  }) === false
);

assert(
  'excludes pending review',
  isPremiumSpotlightActiveRow({
    featured: true,
    status: 'published',
    approval_status: 'Pending Review',
    listing_paid_at: '2026-08-01T00:00:00.000Z',
    listing_expires_at: future,
    type: 'franchise',
  }) === false
);

assert(
  'excludes unpaid / expired listing term',
  isPremiumSpotlightActiveRow({
    featured: true,
    status: 'published',
    approval_status: 'Approved',
    listing_paid_at: '2026-01-01T00:00:00.000Z',
    listing_expires_at: past,
    type: 'franchise',
  }) === false
);

assert(
  'excludes expired spotlight window',
  isPremiumSpotlightActiveRow({
    featured: true,
    status: 'published',
    approval_status: 'Approved',
    listing_paid_at: '2026-08-01T00:00:00.000Z',
    listing_expires_at: future,
    featured_until: past,
    type: 'franchise',
  }) === false
);

assert(
  'excludes draft status',
  isPremiumSpotlightActiveRow({
    featured: true,
    status: 'draft',
    approval_status: 'Approved',
    listing_paid_at: '2026-08-01T00:00:00.000Z',
    listing_expires_at: future,
    type: 'franchise',
  }) === false
);

if (failed) {
  console.error('\n' + failed + ' opportunity spotlight slot check(s) failed.');
  process.exit(1);
}
console.log('\nAll opportunity spotlight slot checks passed.');
