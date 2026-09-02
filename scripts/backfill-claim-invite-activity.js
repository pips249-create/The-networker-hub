#!/usr/bin/env node
/**
 * Backfill entity_activity_log for the Sept 2026 claim rematch sends
 * so Command Centre "House contact" shows claim invite emails.
 *
 * Usage:
 *   node scripts/backfill-claim-invite-activity.js            # dry-run
 *   node scripts/backfill-claim-invite-activity.js --write    # insert rows
 *   node scripts/backfill-claim-invite-activity.js --write --limit=50
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env.local') });
dotenv.config({ path: path.join(root, '.env') });

const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');
const { logClaimInviteSent } = require('../api/_lib/organiser-claim-invite-log');

const CSV = path.join(root, 'data/Claim-Rematch-Resend.csv');
/** Morning of ticket launch / rematch wave (docs/SEGMENT-A-CLAIM-REMATCH.md). */
const SENT_AT = '2026-09-01T08:00:00.000Z';
const CAMPAIGN = 'claim_rematch_prelaunch';
const SLUG = 'organiser_claim_invite';

const args = process.argv.slice(2);
const doWrite = args.includes('--write');
const limitHit = args.find((a) => a.startsWith('--limit='));
const limit = limitHit ? parseInt(limitHit.split('=')[1], 10) || 0 : 0;

function parseCsv(file) {
  if (!fs.existsSync(file)) {
    throw new Error('Missing ' + path.relative(root, file) + ' — run: npm run build:claim-rematch');
  }
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(Boolean).slice(1);
  const rows = [];
  for (const line of lines) {
    const m = line.match(/^([^,]+),("([^"]*)"|[^,]*)/);
    if (!m) continue;
    const email = m[1].trim().toLowerCase();
    const name = (m[3] != null ? m[3] : m[2] || '').replace(/""/g, '"').trim();
    if (!email || !email.includes('@')) continue;
    rows.push({ email, name });
  }
  return rows;
}

async function alreadyLogged(sb, organiserId) {
  const { data, error } = await sb
    .from('entity_activity_log')
    .select('id')
    .eq('organiser_id', organiserId)
    .eq('action', 'admin_claim_invite')
    .contains('metadata', { campaign: CAMPAIGN })
    .limit(1);
  if (error) throw new Error(error.message);
  return Boolean(data && data.length);
}

(async () => {
  if (!isSupabaseConfigured()) throw new Error('Supabase env not configured');
  const sb = getSupabaseAdmin();
  let rows = parseCsv(CSV);
  if (limit > 0) rows = rows.slice(0, limit);

  console.log('CSV rows:', rows.length);
  console.log('Sent-at stamp:', SENT_AT);
  console.log('Mode:', doWrite ? 'WRITE' : 'dry-run');

  let matched = 0;
  let skippedExisting = 0;
  let missing = 0;
  let written = 0;
  let failed = 0;

  for (const row of rows) {
    const { data: byContact, error: cErr } = await sb
      .from('organisers')
      .select('id, name')
      .eq('contact_email', row.email)
      .limit(10);
    if (cErr) throw new Error(cErr.message);
    const { data: byEmail, error: eErr } = await sb
      .from('organisers')
      .select('id, name')
      .eq('email', row.email)
      .limit(10);
    if (eErr) throw new Error(eErr.message);

    const seen = new Set();
    const orgs = [];
    []
      .concat(byContact || [])
      .concat(byEmail || [])
      .forEach((o) => {
        const id = String(o.id || '').trim();
        if (!id || seen.has(id)) return;
        seen.add(id);
        orgs.push(o);
      });

    if (!orgs.length) {
      missing += 1;
      continue;
    }
    matched += 1;

    for (const org of orgs) {
      if (await alreadyLogged(sb, org.id)) {
        skippedExisting += 1;
        continue;
      }
      if (!doWrite) {
        written += 1;
        continue;
      }
      const result = await logClaimInviteSent({
        sb,
        email: row.email,
        organiserId: org.id,
        organiserName: org.name || row.name,
        slug: SLUG,
        source: 'claim_rematch_backfill',
        campaign: CAMPAIGN,
        createdAt: SENT_AT,
        actorEmail: 'system@thenetworkeruk.com',
      });
      if (result && result.ok) written += 1;
      else failed += 1;
    }
  }

  console.log('Matched emails:', matched);
  console.log(doWrite ? 'Inserted:' : 'Would insert:', written);
  console.log('Already logged:', skippedExisting);
  console.log('No organiser match:', missing);
  console.log('Failed:', failed);
  if (!doWrite) {
    console.log('\nRe-run with --write to insert activity rows.');
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
