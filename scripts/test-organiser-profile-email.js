#!/usr/bin/env node
/**
 * Contact-email matches must count as ownership — ticket setup used to miss
 * live listings whose profile email field differed from contact_email.
 * Run: node scripts/test-organiser-profile-email.js
 */
const { emailMatchesProfile, profileEmail } = require('../api/_lib/supabase-organiser-profile-email');

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
  'profileEmail prefers email field',
  profileEmail({ email: 'listing@example.com', contact_email: 'glenn@business-network.co.uk' }) ===
    'listing@example.com'
);
assert(
  'profileEmail falls back to contact_email',
  profileEmail({ email: '', contact_email: 'glenn@business-network.co.uk' }) ===
    'glenn@business-network.co.uk'
);
assert(
  'matches profile email',
  emailMatchesProfile('glenn@business-network.co.uk', {
    email: 'glenn@business-network.co.uk',
    contact_email: 'office@example.com',
  })
);
assert(
  'matches contact email when profile email differs',
  emailMatchesProfile('glenn@business-network.co.uk', {
    email: 'birmingham@business-network.co.uk',
    contact_email: 'glenn@business-network.co.uk',
  })
);
assert(
  'does not match unrelated address',
  !emailMatchesProfile('glenn@business-network.co.uk', {
    email: 'other@example.com',
    contact_email: 'office@example.com',
  })
);

if (failed) {
  process.exit(1);
}
console.log('All organiser profile email checks passed.');
