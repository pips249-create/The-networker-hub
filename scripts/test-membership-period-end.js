#!/usr/bin/env node
/**
 * Unit checks for Stripe Basil-era membership period end helpers.
 * Run: node scripts/test-membership-period-end.js
 */
const {
  periodEndDateString,
  pickLatestExpiresAt,
} = require('../api/_lib/membership-billing');

let failed = 0;

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

assert(
  'legacy top-level current_period_end',
  periodEndDateString({ current_period_end: 1767225600 }) === '2026-01-01'
);

assert(
  'Basil item current_period_end',
  periodEndDateString({
    items: { data: [{ current_period_end: 1769904000 }] },
  }) === '2026-02-01'
);

assert(
  'picks max item period when several',
  periodEndDateString({
    items: {
      data: [{ current_period_end: 1767225600 }, { current_period_end: 1769904000 }],
    },
  }) === '2026-02-01'
);

assert(
  'latest_invoice line period fallback',
  periodEndDateString({
    latest_invoice: {
      lines: { data: [{ period: { end: 1772582400 } }] },
    },
  }) === '2026-03-04'
);

assert('null when nothing present', periodEndDateString({}) === null);

assert(
  'pickLatestExpiresAt prefers later date',
  pickLatestExpiresAt('2026-07-30', '2026-08-30') === '2026-08-30'
);

assert(
  'pickLatestExpiresAt ignores blanks',
  pickLatestExpiresAt(null, '', '2026-08-30') === '2026-08-30'
);

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll period-end checks passed');
