#!/usr/bin/env node
/**
 * Unit checks for paid-ticket refund policy enforcement.
 * Run: node scripts/test-refund-policy-compliance.js
 */
const {
  hasValidRefundPolicy,
  validateRefundPublishPayload,
  assertRefundPolicyForPaidCheckout,
} = require('../api/_lib/event-refund-policy');

let failed = 0;

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

assert('rejects missing policy', !hasValidRefundPolicy({ refund_policy: '' }));
assert('accepts full_refund', hasValidRefundPolicy({ refund_policy: 'full_refund' }));
assert('accepts no_refunds', hasValidRefundPolicy({ refund_policy: 'no_refunds' }));
assert(
  'rejects partial without details',
  !hasValidRefundPolicy({ refund_policy: 'partial_refund', refund_policy_details: '' })
);
assert(
  'accepts legacy partial policy at checkout',
  hasValidRefundPolicy({
    refund_policy: 'partial_refund',
    refund_policy_details: '50% refund if cancelled 14+ days before.',
  })
);

const publishPartial = validateRefundPublishPayload({
  refundPolicy: 'partial_refund',
  refundPolicyDetails: '50% refund if cancelled 14+ days before.',
  refundTermsAgreed: true,
});
assert('publish validation blocks new partial policies', !publishPartial.ok);

const publishOk = validateRefundPublishPayload({
  refundPolicy: 'no_refunds',
  refundTermsAgreed: true,
});
assert('publish validation passes for no_refunds', publishOk.ok);

const publishBad = validateRefundPublishPayload({
  refundPolicy: 'custom',
  refundPolicyDetails: '',
  refundTermsAgreed: true,
});
assert('publish validation blocks custom without details', !publishBad.ok);

try {
  assertRefundPolicyForPaidCheckout({
    refund_policy: 'full_refund',
    refund_terms_agreed: true,
  });
  assert('checkout allows policy + terms agreed', true);
} catch {
  assert('checkout allows policy + terms agreed', false);
}

try {
  assertRefundPolicyForPaidCheckout({ refund_policy: 'full_refund', refund_terms_agreed: false });
  assert('checkout blocks missing terms agreement', false);
} catch (e) {
  assert('checkout blocks missing terms agreement', e.code === 'refund_terms_required');
}

if (failed) {
  console.error('\n' + failed + ' refund policy check(s) failed.');
  process.exit(1);
}
console.log('\nAll refund policy compliance checks passed.');
