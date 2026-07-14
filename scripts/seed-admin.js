#!/usr/bin/env node
/**
 * Create your admin user in Supabase (no Airtable).
 * Usage: node scripts/seed-admin.js
 * Reads local.env or .env
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env') });

const { ensureAdminUser } = require('../api/_lib/supabase-auth');
const { isSupabaseConfigured } = require('../api/_lib/supabase');

async function main() {
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in local.env');
    process.exit(1);
  }
  const email = process.env.ADMIN_EMAIL || 'pips249@gmail.com';
  const password = process.env.ADMIN_INITIAL_PASSWORD;
  if (!password || password.length < 8) {
    console.error('Set ADMIN_INITIAL_PASSWORD in local.env (min 8 characters)');
    process.exit(1);
  }

  const admin = await ensureAdminUser({ email, password, name: 'Platform Admin' });
  console.log('Admin ready:', admin.email);
  console.log('Sign in at /login with that email and password.');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
