#!/usr/bin/env node
/**
 * Smoke test — exclusive brand detection for business opportunities.
 */
const {
  detectExclusiveBrand,
  groupExclusiveBrandDuplicates,
  exclusiveBrandConflictError,
  opportunityHoldsExclusiveBrandSlot,
} = require('../api/_lib/opportunity-brand-exclusivity');

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL:', label);
    process.exitCode = 1;
    return;
  }
  console.log('OK:', label);
}

assert('Utility Warehouse in title', detectExclusiveBrand({ title: 'Join Utility Warehouse' })?.key === 'utility-warehouse');
assert('Arbonne in host', detectExclusiveBrand({ host: 'Arbonne International' })?.key === 'arbonne');
assert('BNI word boundary', detectExclusiveBrand({ title: 'BNI membership opportunity' })?.key === 'bni');
assert('Unrelated brand', detectExclusiveBrand({ title: 'Yorkshire café franchise' }) === null);
assert('Utilitrack is not Utility Warehouse', detectExclusiveBrand({ title: 'Utilitrack Franchise', host: 'Utilitrack' }) === null);
assert(
  'Conflict message mentions brand',
  /Only one BNI listing/.test(
    exclusiveBrandConflictError({
      brand: 'BNI',
      existing: { title: 'Join BNI', host: 'BNI UK', status: 'published', approval_status: 'Approved' },
    })
  )
);
assert(
  'Abandoned draft does not hold exclusive slot',
  opportunityHoldsExclusiveBrandSlot({
    title: 'Utility Warehouse Partner',
    status: 'draft',
    approval_status: 'Pending Review',
    review_submitted_at: null,
  }) === false
);
assert(
  'Submitted pending review holds exclusive slot',
  opportunityHoldsExclusiveBrandSlot({
    title: 'Utility Warehouse Partner',
    status: 'draft',
    approval_status: 'Pending Review',
    review_submitted_at: '2026-11-01T12:00:00.000Z',
  }) === true
);
assert(
  'Approved awaiting payment holds exclusive slot',
  opportunityHoldsExclusiveBrandSlot({
    title: 'Utility Warehouse Partner',
    status: 'draft',
    approval_status: 'Approved',
  }) === true
);
assert(
  'Paid published listing holds exclusive slot',
  opportunityHoldsExclusiveBrandSlot({
    title: 'Utility Warehouse Partner',
    status: 'published',
    approval_status: 'Approved',
    listing_expires_at: new Date(Date.now() + 86400000).toISOString(),
  }) === true
);
assert(
  'Expired published listing does not hold exclusive slot',
  opportunityHoldsExclusiveBrandSlot({
    title: 'Utility Warehouse Partner',
    status: 'published',
    approval_status: 'Approved',
    listing_expires_at: new Date(Date.now() - 86400000).toISOString(),
  }) === false
);
assert(
  'Duplicate groups only when 2+ same brand hold a slot',
  (function () {
    const groups = groupExclusiveBrandDuplicates([
      {
        id: '1',
        title: 'Join BNI Leeds',
        host: 'BNI',
        status: 'published',
        approval_status: 'Approved',
        listing_expires_at: new Date(Date.now() + 86400000).toISOString(),
      },
      {
        id: '2',
        title: 'BNI Manchester',
        host: 'Local chapter',
        status: 'draft',
        approval_status: 'Pending Review',
        review_submitted_at: '2026-11-01T12:00:00.000Z',
      },
      {
        id: '3',
        title: 'Café franchise',
        host: 'Coffee Co',
        status: 'published',
        approval_status: 'Approved',
        listing_expires_at: new Date(Date.now() + 86400000).toISOString(),
      },
      {
        id: '4',
        title: 'Utility Warehouse partner',
        host: 'UW',
        status: 'draft',
        approval_status: 'Pending Review',
        review_submitted_at: null,
      },
      {
        id: '5',
        title: 'Another BNI draft',
        host: 'BNI',
        status: 'draft',
        approval_status: 'Pending Review',
        review_submitted_at: null,
      },
    ]);
    return groups.length === 1 && groups[0].brandKey === 'bni' && groups[0].listings.length === 2;
  })()
);

if (!process.exitCode) {
  console.log('\nAll opportunity brand exclusivity checks passed.');
}
