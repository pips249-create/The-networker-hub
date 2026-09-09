#!/usr/bin/env node
/**
 * Unit checks for admin simple name search (Premium Spotlight).
 * Run: node scripts/test-admin-simple-name-search.js
 */
const { applySimpleNameSearch, tokenizeSearchQuery } = require('../api/_lib/search-match');

let failed = 0;

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

const calls = [];
const fakeQuery = {
  or: function (filter) {
    calls.push(String(filter || ''));
    return fakeQuery;
  },
};

calls.length = 0;
applySimpleNameSearch(fakeQuery, 'The Business Show London', ['title', 'city', 'slug', 'venue']);
assert('drops stopword the', calls.every(function (c) { return c.indexOf('%the%') === -1; }));
assert('requires business', calls.some(function (c) { return c.indexOf('%business%') !== -1; }));
assert('requires show', calls.some(function (c) { return c.indexOf('%show%') !== -1; }));
assert('requires london', calls.some(function (c) { return c.indexOf('%london%') !== -1; }));
assert('no fuzzy underscore variants', calls.every(function (c) { return c.indexOf('%_') === -1; }));
assert('three AND groups for three words', calls.length === 3);

assert(
  'tokenize keeps business show london',
  tokenizeSearchQuery('The Business Show London').join('|') === 'the|business|show|london'
);

if (failed) {
  console.error('\n' + failed + ' assertion(s) failed');
  process.exit(1);
}
console.log('\nAll admin simple name search checks passed.');
