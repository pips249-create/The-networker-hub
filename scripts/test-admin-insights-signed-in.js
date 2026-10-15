#!/usr/bin/env node
const assert = require('assert');
const { keepSignedInAttendees } = require('../api/_lib/admin-insights');

const rows = [
  { id: 'a', supabase_user_id: 'signed-in', location: 'Leeds' },
  { id: 'b', supabase_user_id: 'never', location: 'Imported' },
  { id: 'c', supabase_user_id: null, location: 'Guest' },
  { id: 'd', supabase_user_id: 'signed-in', location: 'Duplicate' },
  { id: 'e', supabase_user_id: '  ', location: 'Blank' },
];

const kept = keepSignedInAttendees(rows, new Set(['signed-in']));
assert.strictEqual(kept.length, 1);
assert.strictEqual(kept[0].id, 'a');
assert.strictEqual(keepSignedInAttendees(rows, ['signed-in']).length, 1);
assert.strictEqual(keepSignedInAttendees(null, ['signed-in']).length, 0);
assert.strictEqual(keepSignedInAttendees(rows, []).length, 0);

console.log('signed-in attendee filter checks passed');
