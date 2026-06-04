#!/usr/bin/env node
/**
 * Import organisers from CSV (no emails sent).
 * Columns: email, name, phone (optional)
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env') });

const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  const emailIdx = header.indexOf('email');
  const nameIdx = header.findIndex((h) => h === 'name' || h === 'organiser name');
  const phoneIdx = header.indexOf('phone');
  if (emailIdx < 0) throw new Error('CSV needs email column');

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const email = cols[emailIdx];
    if (!email) continue;
    rows.push({
      email,
      name: nameIdx >= 0 ? cols[nameIdx] : '',
      phone: phoneIdx >= 0 ? cols[phoneIdx] : '',
    });
  }
  return rows;
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/import-organisers-csv.js data/networking-groups-organisers.csv');
    process.exit(1);
  }
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in local.env');
    process.exit(1);
  }

  const sb = getSupabaseAdmin();
  const rows = parseCsv(fs.readFileSync(path.resolve(file), 'utf8'));
  console.log(`Importing ${rows.length} organisers (no emails)…`);

  let ok = 0;
  let fail = 0;
  for (const row of rows) {
    const em = row.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      fail++;
      continue;
    }
    const payload = {
      name: String(row.name || em.split('@')[0]).trim() || 'Organiser',
      email: em,
      phone: row.phone ? String(row.phone).trim() : null,
      organiser_type: 'Events',
      verification_status: 'Verified',
      listing_status: 'published',
    };
    const { data: existing } = await sb.from('organisers').select('id').eq('email', em).maybeSingle();
    let error;
    if (existing?.id) {
      ({ error } = await sb.from('organisers').update(payload).eq('id', existing.id));
    } else {
      ({ error } = await sb.from('organisers').insert(payload));
    }
    if (error) {
      fail++;
      if (fail <= 5) console.error('Skip', em, '-', error.message);
    } else ok++;
  }
  console.log(`Done: ${ok} organisers saved, ${fail} skipped.`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
