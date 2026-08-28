#!/usr/bin/env node
/**
 * UUID helpers — including recovery of glued "?id=" query suffixes.
 * Run: node scripts/test-uuid.js
 */
const { isUuid, coerceUuid, hasIdInput } = require('../api/_lib/uuid');

let failed = 0;

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

const A = 'f092f43d-9c43-4614-83f6-50f0139a77e9';
const B = '9dafedfa-5923-4375-9fd6-0d3c7a0189f1';

assert('plain uuid', isUuid(A) && coerceUuid(A) === A);
assert('uppercase uuid', coerceUuid(A.toUpperCase()) === A.toUpperCase());
assert('trim whitespace', coerceUuid('  ' + A + '  ') === A);
assert('empty', coerceUuid('') === '' && !hasIdInput(''));
assert('nullish', coerceUuid(null) === '' && coerceUuid(undefined) === '');
assert('garbage', coerceUuid('not-a-uuid') === '' && hasIdInput('not-a-uuid'));

assert(
  'glued query string from GET /api/organiser/events?id=uuid?id=other',
  coerceUuid(A + '?id=' + B) === A
);
assert(
  'percent-encoded glued query',
  coerceUuid(A + '%3Fid%3D' + B) === A
);
assert('array query values take first uuid', coerceUuid([A, B]) === A);
assert('array with empty then uuid', coerceUuid(['', A]) === A);
assert('leading question mark still finds uuid', coerceUuid('?id=' + B) === B);
assert('url with id query', coerceUuid('https://www.thenetworkeruk.com/events/event?id=' + A) === A);
assert('hasIdInput glued', hasIdInput(A + '?id=' + B));
assert('hasIdInput array', hasIdInput([A]));

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll uuid tests passed.');
