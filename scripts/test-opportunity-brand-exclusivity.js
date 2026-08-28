#!/usr/bin/env node
/**
 * Smoke test — exclusive brand detection for business opportunities.
 */
const {
  detectExclusiveBrand,
  groupExclusiveBrandDuplicates,
  exclusiveBrandConflictError,
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
assert(
  'Conflict message mentions brand',
  /Only one BNI listing/.test(
    exclusiveBrandConflictError({
      brand: 'BNI',
      existing: { title: 'Join BNI', host: 'BNI UK' },
    })
  )
);
assert(
  'Duplicate groups only when 2+ same brand',
  (function () {
    const groups = groupExclusiveBrandDuplicates([
      { id: '1', title: 'Join BNI Leeds', host: 'BNI' },
      { id: '2', title: 'BNI Manchester', host: 'Local chapter' },
      { id: '3', title: 'Café franchise', host: 'Coffee Co' },
      { id: '4', title: 'Utility Warehouse partner', host: 'UW' },
    ]);
    return groups.length === 1 && groups[0].brandKey === 'bni' && groups[0].listings.length === 2;
  })()
);

if (!process.exitCode) {
  console.log('\nAll opportunity brand exclusivity checks passed.');
}
