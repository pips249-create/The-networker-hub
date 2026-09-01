#!/usr/bin/env node
/**
 * Build the affiliate-only opportunity claim invite list for Resend.
 *
 * Audience: unclaimed published affiliate listings with a real owner email.
 *
 * Usage:
 *   node scripts/build-affiliate-claim-resend.js
 *
 * Outputs:
 *   data/Affiliate-Claim-Resend.csv
 *   data/Affiliate-Claim-Resend-batch-NN.csv
 *   data/Affiliate-Claim-Resend-summary.json
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
const OUT_CSV = path.join(root, 'data/Affiliate-Claim-Resend.csv');
const OUT_SUMMARY = path.join(root, 'data/Affiliate-Claim-Resend-summary.json');

const SKIP_EMAILS = new Set([
  'hi@thenetworkeruk.com',
  'catherine@thenetworkeruk.com',
  'rosie@thenetworkeruk.com',
]);

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

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('business_opportunities')
    .select('id, title, slug, host, owner_email, ownership_claim_status, status, approval_status, type')
    .eq('ownership_claim_status', 'pending')
    .eq('type', 'affiliate')
    .eq('status', 'published')
    .order('title');
  if (error) throw new Error(error.message);

  let skippedNoEmail = 0;
  let skippedInternal = 0;
  let skippedTest = 0;
  let skippedNotApproved = 0;

  const rows = [];
  for (const row of data || []) {
    const email = String(row.owner_email || '')
      .trim()
      .toLowerCase();
    const title = String(row.title || '').trim();
    const slug = String(row.slug || row.id || '').trim();

    if (!email.includes('@') || isHubSeedOwnerEmail(email)) {
      skippedNoEmail += 1;
      continue;
    }
    if (SKIP_EMAILS.has(email)) {
      skippedInternal += 1;
      continue;
    }
    if (/^\[TEST\]/i.test(title)) {
      skippedTest += 1;
      continue;
    }
    if (String(row.approval_status || '').trim() !== 'Approved') {
      skippedNotApproved += 1;
      continue;
    }
    if (!slug) {
      skippedNoEmail += 1;
      continue;
    }

    rows.push({
      email,
      title: title || 'your affiliate programme',
      ownerName: ownerName(row),
      host: String(row.host || '').trim(),
      slug,
      claimUrl: claimUrlFor(email, slug),
    });
  }

  rows.sort((a, b) => a.title.localeCompare(b.title, 'en'));

  writeCsv(OUT_CSV, rows);

  const batchFiles = [];
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const n = String(Math.floor(i / BATCH) + 1).padStart(2, '0');
    const file = path.join(root, 'data/Affiliate-Claim-Resend-batch-' + n + '.csv');
    writeCsv(file, batch);
    batchFiles.push(path.relative(root, file));
  }

  const summary = {
    built_at: new Date().toISOString(),
    audience: 'unclaimed_published_affiliate_listings',
    recipients: rows.length,
    batch_size: BATCH,
    batch_files: batchFiles,
    skipped: {
      no_email: skippedNoEmail,
      internal: skippedInternal,
      test_title: skippedTest,
      not_approved: skippedNotApproved,
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
  batchFiles.forEach((f) => console.log(' ', f));
})();
