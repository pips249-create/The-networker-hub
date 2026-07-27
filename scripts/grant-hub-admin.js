#!/usr/bin/env node
/**
 * Promote existing hub logins to Command Centre admin (hub_accounts.role = admin).
 * Usage: node scripts/grant-hub-admin.js email@example.com [more@example.com ...]
 * Reads local.env or .env for SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env') });

const { promoteUserToAdmin } = require('../api/_lib/supabase-auth');
const { isSupabaseConfigured } = require('../api/_lib/supabase');

const DEFAULT_NAMES = {
  'catherine@thenetworkerhub.com': 'Catherine',
  'rosie@thenetworkerhub.com': 'Rosie',
  'rosie.mcgilvray@yahoo.co.uk': 'Rosie McGilvray',
};

async function main() {
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in local.env');
    process.exit(1);
  }

  const emails = process.argv
    .slice(2)
    .map((e) => String(e || '').trim().toLowerCase())
    .filter(Boolean);

  if (!emails.length) {
    console.error('Usage: node scripts/grant-hub-admin.js <email> [email ...]');
    process.exit(1);
  }

  let failed = 0;
  for (const email of emails) {
    try {
      const result = await promoteUserToAdmin({
        email,
        name: DEFAULT_NAMES[email] || '',
      });
      console.log('Admin granted:', result.email, '(' + (result.name || 'admin') + ')');
    } catch (e) {
      failed += 1;
      console.error('Failed:', email, '—', e.message || e);
    }
  }

  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
