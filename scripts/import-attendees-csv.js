#!/usr/bin/env node
/**
 * Import users from CSV into attendees ONLY — no login accounts, no emails.
 *
 * CSV columns (header row): email, name  (name optional)
 *
 * Usage:
 *   node scripts/import-attendees-csv.js path/to/users.csv
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env') });

const { importAttendeeRow } = require('../api/_lib/supabase-auth');
const { isSupabaseConfigured } = require('../api/_lib/supabase');

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  const emailIdx = header.findIndex((h) => h === 'email' || h === 'e-mail');
  const nameIdx = header.findIndex((h) => h === 'name' || h === 'full name');
  if (emailIdx < 0) throw new Error('CSV needs an "email" column');

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const email = cols[emailIdx];
    if (!email) continue;
    rows.push({ email, name: nameIdx >= 0 ? cols[nameIdx] : '' });
  }
  return rows;
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/import-attendees-csv.js users.csv');
    process.exit(1);
  }
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in local.env');
    process.exit(1);
  }

  const text = fs.readFileSync(path.resolve(file), 'utf8');
  const rows = parseCsv(text);
  console.log(`Importing ${rows.length} rows into attendees (no emails will be sent)…`);

  let ok = 0;
  let fail = 0;
  for (const row of rows) {
    try {
      await importAttendeeRow(row);
      ok++;
    } catch (e) {
      fail++;
      console.error('Skip', row.email, '-', e.message);
    }
  }
  console.log(`Done: ${ok} saved, ${fail} skipped.`);
  console.log('These users are NOT sent email and cannot sign in until you create Auth accounts.');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
