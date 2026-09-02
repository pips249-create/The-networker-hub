#!/usr/bin/env node
/**
 * Send franchise-only opportunity claim invites via Resend.
 *
 * Audience CSV must come from scripts/build-franchise-claim-resend.js
 *
 * Usage:
 *   node scripts/send-franchise-claim-resend.js                         # dry-run
 *   node scripts/send-franchise-claim-resend.js --test you@example.com
 *   node scripts/send-franchise-claim-resend.js --send --limit=10
 *   node scripts/send-franchise-claim-resend.js --send
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env.local') });
dotenv.config({ path: path.join(root, '.env') });

const { sendTemplatedEmail } = require('../api/_lib/send-template-email');
const { mergeEmailPreviewVariables } = require('../api/_lib/email-preview-variables');
const { campaignSiteVars } = require('../api/_lib/organiser-campaign-defaults');

const SITE = 'https://www.thenetworkeruk.com';
const CSV = path.join(root, 'data/Franchise-Claim-Resend.csv');
const SLUG = 'franchise_claim_invite';
const REPLY_TO = 'catherine@thenetworkeruk.com';
const FOOTER_EMAIL = 'hi@thenetworkeruk.com';
const SUBJECT = 'Franchise Listing Invitation';

const args = process.argv.slice(2);
const doSend = args.includes('--send');
const testIdx = args.indexOf('--test');
const testTo = testIdx >= 0 ? String(args[testIdx + 1] || '').trim().toLowerCase() : '';

function argValue(name, fallback) {
  const hit = args.find((a) => a.startsWith('--' + name + '='));
  if (!hit) return fallback;
  const n = parseInt(hit.split('=')[1], 10);
  return Number.isFinite(n) ? n : fallback;
}

const offset = Math.max(0, argValue('offset', 0));
const limit = argValue('limit', 0);

function parseCsv(file) {
  if (!fs.existsSync(file)) {
    throw new Error(
      'Missing ' +
        path.relative(root, file) +
        ' — run: node scripts/build-franchise-claim-resend.js'
    );
  }
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(Boolean).slice(1);
  const rows = [];
  for (const line of lines) {
    const m = line.match(
      /^([^,]+),("([^"]*)"|[^,]*),("([^"]*)"|[^,]*),("([^"]*)"|[^,]*),("([^"]*)"|[^,]*),("([^"]*)"|[^,]*)?$/
    );
    if (!m) continue;
    rows.push({
      email: m[1].trim().toLowerCase(),
      title: (m[3] != null ? m[3] : m[2] || '').replace(/""/g, '"').trim(),
      ownerName: (m[5] != null ? m[5] : m[4] || '').replace(/""/g, '"').trim(),
      claimUrl: (m[9] != null ? m[9] : m[8] || '').replace(/""/g, '"').trim(),
    });
  }
  return rows.filter((r) => r.email && r.email.includes('@') && r.claimUrl);
}

async function sendOne(row, toOverride) {
  const to = toOverride || row.email;
  const title = row.title || 'your franchise';
  const vars = mergeEmailPreviewVariables(
    SLUG,
    {
      ...campaignSiteVars(SITE),
      owner_name: row.title || row.ownerName || 'there',
      opportunity_title: title,
      claim_url: row.claimUrl,
      support_email: FOOTER_EMAIL,
    },
    SITE
  );
  return sendTemplatedEmail({
    slug: SLUG,
    to,
    subject: SUBJECT,
    variables: vars,
    skipEmailCheck: true,
    replyTo: REPLY_TO,
    resendTags: [
      { name: 'campaign', value: 'opportunity_claim_franchise' },
      { name: 'segment', value: 'franchise_unclaimed' },
    ],
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  const allRows = parseCsv(CSV);
  const slice = limit > 0 ? allRows.slice(offset, offset + limit) : allRows.slice(offset);

  console.log('From:', process.env.RESEND_FROM || '(RESEND_FROM / default)');
  console.log('Reply-to:', REPLY_TO);
  console.log('Template:', SLUG);
  console.log('Subject:', SUBJECT);
  console.log('CSV recipients:', allRows.length);
  console.log('This run:', slice.length, '(offset', offset + (limit ? ', limit ' + limit : '') + ')');
  console.log('Audience: unclaimed franchise listings only');

  if (!process.env.RESEND_API_KEY && (doSend || testTo)) {
    throw new Error('RESEND_API_KEY is not set');
  }

  if (testTo) {
    const row = allRows[0];
    if (!row) throw new Error('CSV is empty');
    console.log('Test send to', testTo, 'using row:', row.title);
    const result = await sendOne(row, testTo);
    console.log('Sent:', result);
    return;
  }

  if (!doSend) {
    console.log('\nDry run — pass --send to deliver, or --test you@example.com');
    slice.slice(0, 5).forEach((r) => console.log(' ', r.email, '—', r.title));
    if (slice.length > 5) console.log(' ... and', slice.length - 5, 'more');
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const row of slice) {
    try {
      await sendOne(row);
      sent += 1;
      console.log('Sent', sent + '/' + slice.length, row.email, '—', row.title);
      await sleep(600);
    } catch (err) {
      failed += 1;
      console.error('Failed', row.email, err.message || err);
    }
  }
  console.log('Done. Sent:', sent, 'Failed:', failed);
})();
