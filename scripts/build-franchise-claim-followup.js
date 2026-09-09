#!/usr/bin/env node
/**
 * Build Franchise Email 2 (claim follow-up) audience for Resend.
 *
 * Audience: published franchise listings that are still unclaimed / unpaid,
 * with a real owner email. Preferentially intersects with Email 1 CSV when
 * present (data/Franchise-Claim-Resend.csv) so we only nudge people we already
 * invited.
 *
 * Optional skip list: data/Franchise-Claim-Followup-skip.csv (one email per line,
 * or Email column) for people who replied / asked to be left alone.
 *
 * Usage:
 *   node scripts/build-franchise-claim-followup.js
 *
 * Outputs:
 *   data/Franchise-Claim-Followup.csv
 *   data/Franchise-Claim-Followup-batch-NN.csv
 *   data/Franchise-Claim-Followup-summary.json
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env.local') });
dotenv.config({ path: path.join(root, '.env') });

const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');
const { previewClaimUrl } = require('../api/_lib/opportunity-claim-url');
const { isHubSeedOwnerEmail } = require('../api/_lib/opportunity-hub-seed');

const SITE = 'https://www.thenetworkeruk.com';
const BATCH = 50;
const OUT_CSV = path.join(root, 'data/Franchise-Claim-Followup.csv');
const OUT_SUMMARY = path.join(root, 'data/Franchise-Claim-Followup-summary.json');
const EMAIL1_CSV = path.join(root, 'data/Franchise-Claim-Resend.csv');
const SKIP_CSV = path.join(root, 'data/Franchise-Claim-Followup-skip.csv');

const SKIP_EMAILS = new Set([
  'hi@thenetworkeruk.com',
  'catherine@thenetworkeruk.com',
  'rosie@thenetworkeruk.com',
]);

const SKIP_TITLE = /^\[TEST\]|york open day demo|demo — the networker/i;

function esc(v) {
  return '"' + String(v || '').replace(/"/g, '""') + '"';
}

function ownerName(row) {
  const title = String(row.title || '').trim();
  return title || 'there';
}

function claimUrlFor(email, slug) {
  return previewClaimUrl(SITE, email, 'register', slug);
}

function dedupeKey(row) {
  return (
    String(row.title || '')
      .trim()
      .toLowerCase() +
    '|' +
    String(row.owner_email || '')
      .trim()
      .toLowerCase()
  );
}

function loadEmailSet(file) {
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const set = new Set();
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    if (i === 0 && /^email\b/i.test(line)) continue;
    const email = line.split(',')[0].trim().toLowerCase().replace(/^"|"$/g, '');
    if (email.includes('@')) set.add(email);
  }
  return set;
}

function writeCsv(file, rows) {
  const bom = '\uFEFF';
  const body =
    bom +
    'Email,Opportunity title,Owner name,Host,CLAIM_URL,Slug\n' +
    rows
      .map(
        (r) =>
          r.email +
          ',' +
          esc(r.title) +
          ',' +
          esc(r.ownerName) +
          ',' +
          esc(r.host) +
          ',' +
          esc(r.claimUrl) +
          ',' +
          esc(r.slug)
      )
      .join('\n') +
    '\n';
  fs.writeFileSync(file, body);
}

(async () => {
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in local.env');
    process.exit(1);
  }

  const email1Set = loadEmailSet(EMAIL1_CSV);
  const replySkip = loadEmailSet(SKIP_CSV) || new Set();
  for (const e of replySkip) SKIP_EMAILS.add(e);

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('business_opportunities')
    .select(
      'id, title, slug, host, owner_email, ownership_claim_status, ownership_claimed_at, listing_stripe_subscription_id, status, approval_status, type'
    )
    .eq('type', 'franchise')
    .eq('status', 'published')
    .order('title');
  if (error) throw new Error(error.message);

  let skippedNoEmail = 0;
  let skippedInternal = 0;
  let skippedTest = 0;
  let skippedNotApproved = 0;
  let skippedDuplicate = 0;
  let skippedClaimedOrPaid = 0;
  let skippedNotInEmail1 = 0;

  const byDedupe = new Map();
  for (const row of data || []) {
    const email = String(row.owner_email || '')
      .trim()
      .toLowerCase();
    const title = String(row.title || '').trim();
    const slug = String(row.slug || row.id || '').trim();
    const claimStatus = String(row.ownership_claim_status || '')
      .trim()
      .toLowerCase();
    const claimed =
      claimStatus === 'claimed' ||
      Boolean(row.ownership_claimed_at) ||
      Boolean(row.listing_stripe_subscription_id);

    if (!email.includes('@') || isHubSeedOwnerEmail(email)) {
      skippedNoEmail += 1;
      continue;
    }
    if (SKIP_EMAILS.has(email)) {
      skippedInternal += 1;
      continue;
    }
    if (SKIP_TITLE.test(title)) {
      skippedTest += 1;
      continue;
    }
    if (String(row.approval_status || '').trim() !== 'Approved') {
      skippedNotApproved += 1;
      continue;
    }
    if (claimed || claimStatus !== 'pending') {
      skippedClaimedOrPaid += 1;
      continue;
    }
    if (!slug) {
      skippedNoEmail += 1;
      continue;
    }
    if (email1Set && !email1Set.has(email)) {
      skippedNotInEmail1 += 1;
      continue;
    }

    const key = dedupeKey(row);
    const existing = byDedupe.get(key);
    if (existing) {
      skippedDuplicate += 1;
      if (String(row.id) < String(existing.id)) {
        byDedupe.set(key, row);
      }
      continue;
    }
    byDedupe.set(key, row);
  }

  const rows = Array.from(byDedupe.values())
    .map((row) => ({
      email: String(row.owner_email || '')
        .trim()
        .toLowerCase(),
      title: String(row.title || '').trim() || 'your franchise',
      ownerName: ownerName(row),
      host: String(row.host || '').trim(),
      slug: String(row.slug || row.id || '').trim(),
      claimUrl: claimUrlFor(
        String(row.owner_email || '')
          .trim()
          .toLowerCase(),
        String(row.slug || row.id || '').trim()
      ),
    }))
    .sort((a, b) => a.title.localeCompare(b.title, 'en'));

  writeCsv(OUT_CSV, rows);

  const batchFiles = [];
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const n = String(Math.floor(i / BATCH) + 1).padStart(2, '0');
    const file = path.join(root, 'data/Franchise-Claim-Followup-batch-' + n + '.csv');
    writeCsv(file, batch);
    batchFiles.push(path.relative(root, file));
  }

  const summary = {
    built_at: new Date().toISOString(),
    audience: 'franchise_email2_unclaimed_from_email1',
    email1_csv: email1Set ? path.relative(root, EMAIL1_CSV) : null,
    email1_recipients: email1Set ? email1Set.size : null,
    skip_csv: replySkip.size ? path.relative(root, SKIP_CSV) : null,
    skip_replies: replySkip.size,
    recipients: rows.length,
    batch_size: BATCH,
    batch_files: batchFiles,
    skipped: {
      no_email: skippedNoEmail,
      internal_or_reply_skip: skippedInternal,
      test_title: skippedTest,
      not_approved: skippedNotApproved,
      claimed_or_paid_or_not_pending: skippedClaimedOrPaid,
      not_in_email1: skippedNotInEmail1,
      duplicate_title_email: skippedDuplicate,
    },
    sample: rows.slice(0, 5).map((r) => ({
      email: r.email,
      title: r.title,
      claim_url: r.claimUrl,
    })),
  };
  fs.writeFileSync(OUT_SUMMARY, JSON.stringify(summary, null, 2) + '\n');

  console.log('Wrote', path.relative(root, OUT_CSV), '—', rows.length, 'recipients');
  console.log('Summary:', path.relative(root, OUT_SUMMARY));
  if (email1Set) console.log('Intersected with Email 1 CSV:', email1Set.size, 'addresses');
  if (replySkip.size) console.log('Skipped replies list:', replySkip.size);
  batchFiles.forEach((f) => console.log(' ', f));
})();
