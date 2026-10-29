#!/usr/bin/env node
/**
 * Unit tests for Hubert Matchmaker search quota helpers (no DB).
 */
const assert = require('assert');
const {
  SEARCHES_PER_WEEK,
  ADMIN_SEARCHES_PER_WEEK,
  searchCapForSession,
  isMissingSearchTableError,
} = require('../api/_lib/hubert-matchmaker-search-quota');
const fs = require('fs');
const path = require('path');

assert.strictEqual(SEARCHES_PER_WEEK, 3, 'members get 3 searches / week');
assert.strictEqual(ADMIN_SEARCHES_PER_WEEK, 50, 'admins get a higher search cap');
assert.strictEqual(searchCapForSession({ role: 'client' }), 3, 'client cap');
assert.strictEqual(searchCapForSession({ role: 'admin' }), 50, 'admin cap');
assert.strictEqual(searchCapForSession(null), 3, 'signed-out treated as member cap');

assert.ok(
  isMissingSearchTableError({
    code: 'PGRST205',
    message: "Could not find the table 'public.hubert_matchmaker_searches' in the schema cache",
  }),
  'detects missing search table'
);
assert.ok(
  !isMissingSearchTableError({ code: '42501', message: 'permission denied' }),
  'other errors are not soft-skipped'
);

const migration = fs.readFileSync(
  path.join(__dirname, '../supabase/migrations/344_hubert_matchmaker_searches.sql'),
  'utf8'
);
assert.ok(migration.includes('hubert_matchmaker_searches'), 'migration creates search log');
assert.ok(migration.includes('attendee_id'), 'migration indexes by attendee');

const route = fs.readFileSync(
  path.join(__dirname, '../api/_lib/routes/auth-hubert-matchmaker.js'),
  'utf8'
);
assert.ok(route.includes('search_quota_exceeded'), 'route maps search quota 429');
assert.ok(route.includes('consumeSearchQuota'), 'route consumes quota on search');
assert.ok(route.includes("action === 'search_quota'"), 'route exposes search_quota');

const ui = fs.readFileSync(path.join(__dirname, '../js/hubert-matchmaker.js'), 'utf8');
assert.ok(ui.includes('search_quota_exceeded'), 'client handles search quota');
assert.ok(ui.includes('data-hmm-search-quota') || ui.includes('searchQuota'), 'client paints search quota');
assert.ok(ui.includes('refreshSearchQuota'), 'client refreshes search quota');

console.log('ok — hubert search quota');
