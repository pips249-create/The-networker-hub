#!/usr/bin/env node
/**
 * Remove ranking-demo seed attendee addresses from outbound mail and member linkage.
 *
 * - Rewrites *@demo.hub.local → *@networkerhub.example (RFC 2606 — not deliverable)
 * - Clears supabase_user_id so Hubert / nurture crons skip them
 * - Does not delete reviews (organiser rating counts stay intact)
 *
 * Usage:
 *   node scripts/delete-ranking-demo-attendees.js           # dry run
 *   node scripts/delete-ranking-demo-attendees.js --execute
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env.local') });
dotenv.config({ path: path.join(root, '.env') });

const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');
const { isSeedAttendeeEmail, normalizeEmail } = require('../api/_lib/seed-attendee-email');

const REPLACEMENT_DOMAIN = '@networkerhub.example';

function targetEmail(currentEmail) {
  const normalized = normalizeEmail(currentEmail);
  if (!normalized) return '';
  if (normalized.endsWith('@demo.hub.local')) {
    return normalized.replace(/@demo\.hub\.local$/, REPLACEMENT_DOMAIN);
  }
  return normalized;
}

async function fetchSeedAttendees(sb) {
  const rows = [];
  let from = 0;
  const pageSize = 500;

  while (true) {
    const { data, error } = await sb
      .from('attendees')
      .select('id, email, name, supabase_user_id')
      .or('email.ilike.%@demo.hub.local,email.ilike.ranking-demo-%')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = data || [];
    rows.push(...batch.filter((row) => isSeedAttendeeEmail(row.email)));
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function main() {
  const execute = process.argv.includes('--execute');
  if (!isSupabaseConfigured()) {
    console.error('Supabase is not configured.');
    process.exit(1);
  }

  const sb = getSupabaseAdmin();
  const attendees = await fetchSeedAttendees(sb);

  if (!attendees.length) {
    console.log('No ranking-demo seed attendee rows found.');
    return;
  }

  console.log(`${execute ? 'Updating' : 'Would update'} ${attendees.length} seed attendee row(s):\n`);

  let updated = 0;
  for (const row of attendees) {
    const nextEmail = targetEmail(row.email);
    const clearUser = Boolean(row.supabase_user_id);
    const emailChange = normalizeEmail(row.email) !== nextEmail;

    console.log(
      `  ${row.email}` +
        (emailChange ? ` → ${nextEmail}` : '') +
        (clearUser ? ' (clear linked account)' : '')
    );

    if (!execute) continue;
    if (!nextEmail) continue;

    const patch = {};
    if (emailChange) patch.email = nextEmail;
    if (clearUser) patch.supabase_user_id = null;

    if (!Object.keys(patch).length) continue;

    const { error } = await sb.from('attendees').update(patch).eq('id', row.id);
    if (error) {
      console.error(`  ✗ ${row.id}: ${error.message}`);
      continue;
    }
    updated += 1;
  }

  if (execute) {
    console.log(`\nUpdated ${updated} row(s). Outbound mail to these addresses is blocked in send-template-email.`);
  } else {
    console.log('\nDry run only. Pass --execute to apply.');
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
