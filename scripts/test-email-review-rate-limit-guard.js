#!/usr/bin/env node
/**
 * Email review POST must check limited.allowed — not truthiness of the result object.
 * Run: node scripts/test-email-review-rate-limit-guard.js
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../api/_lib/routes/email-review.js'), 'utf8');

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
  'does not early-return on truthy rate-limit object',
  !/if\s*\(\s*limited\s*\)\s*return\s*;/.test(src)
);
assert('checks limited.allowed', /!limited\.allowed/.test(src));
assert('returns JSON 429 when limited', /rate_limited/.test(src) && /429/.test(src));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('email review rate-limit guard checks passed');
