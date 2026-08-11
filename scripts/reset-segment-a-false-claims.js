#!/usr/bin/env node
/**
 * Reset Segment A soft-created hub accounts that were incorrectly marked claimed.
 *
 * Source: data/Segment-A-hub-accounts-enriched.csv rows with claim_status=claimed
 * (never signed in). Sets ownership_claim_status=pending and clears ownership_claimed_at.
 * Keeps supabase_user_id + organiser_account_id so Email 2 login → claim still works.
 *
 * Usage:
 *   node scripts/reset-segment-a-false-claims.js
 *   node scripts/reset-segment-a-false-claims.js --execute
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
for (const name of ['local.env', '.env.local', '.env']) {
  const p = path.join(root, name);
  if (fs.existsSync(p)) dotenv.config({ path: p, override: false });
}

const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');

const ENRICHED = path.join(root, 'data/Segment-A-hub-accounts-enriched.csv');
const EXECUTE = process.argv.includes('--execute');

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.length);
  const split = (line) => {
    const cols = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else if (c === '"') {
          inQ = false;
        } else {
          cur += c;
        }
      } else if (c === '"') {
        inQ = true;
      } else if (c === ',') {
        cols.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
    cols.push(cur);
    return cols;
  };
  const header = split(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = split(line);
    const obj = {};
    header.forEach((h, i) => {
      obj[h] = cols[i] != null ? cols[i] : '';
    });
    return obj;
  });
}

(async () => {
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in local.env');
    process.exit(1);
  }
  if (!fs.existsSync(ENRICHED)) {
    console.error('Missing', path.relative(root, ENRICHED), '— run enrich-segment-a-hub-accounts.js first');
    process.exit(1);
  }

  const sb = getSupabaseAdmin();
  const rows = parseCsv(fs.readFileSync(ENRICHED, 'utf8'));
  const targets = rows.filter((r) => r.claim_status === 'claimed' && r.organiser_id);
  const ids = [...new Set(targets.map((r) => r.organiser_id))];

  console.log(EXECUTE ? 'EXECUTE' : 'DRY RUN');
  console.log('Targets (claimed in enriched CSV):', ids.length);

  const signedIn = targets.filter((r) => String(r.has_signed_in || '').toLowerCase() === 'yes');
  if (signedIn.length) {
    console.error(
      'Abort: some targets have signed in:',
      signedIn.map((r) => r.email).slice(0, 10)
    );
    process.exit(1);
  }

  if (!ids.length) {
    console.log('Nothing to reset.');
    return;
  }

  if (!EXECUTE) {
    console.log(
      'Sample:',
      targets.slice(0, 8).map((r) => r.slug || r.organiser_name)
    );
    console.log('Re-run with --execute to apply.');
    return;
  }

  let updated = 0;
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const { data, error } = await sb
      .from('organisers')
      .update({
        ownership_claim_status: 'pending',
        ownership_claimed_at: null,
      })
      .in('id', chunk)
      .eq('ownership_claim_status', 'claimed')
      .select('id');
    if (error) throw new Error(error.message);
    updated += (data || []).length;
    console.log('Chunk', Math.floor(i / 50) + 1, 'updated', (data || []).length);
  }

  const { count, error: cErr } = await sb
    .from('organisers')
    .select('id', { count: 'exact', head: true })
    .in('id', ids)
    .eq('ownership_claim_status', 'pending');
  if (cErr) throw new Error(cErr.message);

  console.log('Updated rows:', updated);
  console.log('Now pending among targets:', count);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
