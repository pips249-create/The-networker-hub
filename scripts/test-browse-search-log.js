/**
 * Unit checks for browse search sanitisation (no Supabase required).
 * Run: node scripts/test-browse-search-log.js
 */
const assert = require('assert');
const {
  sanitizeBrowseSearchPayload,
  normalizeQuery,
  normalizeLocation,
} = require('../api/_lib/browse-search-log');

assert.strictEqual(normalizeQuery('  Hello   WORLD  '), 'hello world');
assert.ok(normalizeQuery('x'.repeat(200)).length <= 120);
assert.strictEqual(normalizeLocation('  SW1A 1AA  '), 'SW1A 1AA');

const empty = sanitizeBrowseSearchPayload({});
assert.strictEqual(empty.ok, false);
assert.strictEqual(empty.error, 'no_signal');

const withQuery = sanitizeBrowseSearchPayload({
  q: '  Networking  Breakfast ',
  resultCount: 12,
  types: 'meetings,Meetings,exhibitions',
  inPerson: '1',
  sort: 'recommended',
});
assert.strictEqual(withQuery.ok, true);
assert.strictEqual(withQuery.row.query_text, 'networking breakfast');
assert.strictEqual(withQuery.row.result_count, 12);
assert.strictEqual(withQuery.row.zero_results, false);
assert.deepStrictEqual(withQuery.row.filters.types, ['meetings', 'exhibitions']);
assert.strictEqual(withQuery.row.filters.inPerson, true);

const zero = sanitizeBrowseSearchPayload({ q: 'obscure city', resultCount: 0 });
assert.strictEqual(zero.ok, true);
assert.strictEqual(zero.row.zero_results, true);

const zeroOnly = sanitizeBrowseSearchPayload({ resultCount: 0 });
assert.strictEqual(zeroOnly.ok, false);

console.log('test-browse-search-log: ok');
