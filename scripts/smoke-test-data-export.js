#!/usr/bin/env node
/**
 * Smoke test for user data export builder (no live Supabase required).
 */
const assert = require('assert');
const { buildUserDataExport } = require('../api/_lib/user-data-export');

async function testShapeWithoutSupabase() {
  const original = process.env.SUPABASE_URL;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  let threw = false;
  try {
    await buildUserDataExport({ sub: 'user-1', email: 'test@example.com' });
  } catch (e) {
    threw = true;
  } finally {
    if (original) process.env.SUPABASE_URL = original;
  }

  assert.ok(threw, 'expected export to require Supabase admin client');
  console.log('  ✓ requires Supabase configuration');
}

function testModuleExports() {
  assert.strictEqual(typeof buildUserDataExport, 'function');
  console.log('  ✓ buildUserDataExport exported');
}

(async function main() {
  console.log('User data export smoke test\n');
  testModuleExports();
  await testShapeWithoutSupabase();
  console.log('\nOK');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
