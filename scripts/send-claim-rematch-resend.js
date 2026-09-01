#!/usr/bin/env node
/**
 * Send the pre-launch claim rematch via Resend.
 *
 * Audience CSV must come from scripts/build-claim-rematch-resend.js
 * (unclaimed networking groups only — not the ~3500 attendee list).
 *
 * Usage:
 *   node scripts/send-claim-rematch-resend.js                         # dry-run
 *   node scripts/send-claim-rematch-resend.js --test you@example.com
 *   node scripts/send-claim-rematch-resend.js --send --limit=50      # first 50
 *   node scripts/send-claim-rematch-resend.js --send                 # full list
 *   node scripts/send-claim-rematch-resend.js --send --offset=50 --limit=50
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
const CSV = path.join(root, 'data/Claim-Rematch-Resend.csv');
const SLUG = 'organiser_claim_invite';
const REPLY_TO = 'catherine@thenetworkeruk.com';
/** Launch-morning subject — tickets go live today. */
const REMATCH_SUBJECT =
  "It's FREE to claim {{organiser_name}} — tickets go live this morning";

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
        ' — run: node scripts/build-claim-rematch-resend.js'
    );
  }
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(Boolean).slice(1);
  const rows = [];
  for (const line of lines) {
    // Email,Organiser name,OTHER_GROUPS_NOTE,CLAIM_URL,Group count,Has account
    const m = line.match(
      /^([^,]+),("([^"]*)"|[^,]*),("([^"]*)"|[^,]*),("([^"]*)"|[^,]*),([^,]*),("([^"]*)"|[^,]*)?$/
    );
    if (!m) continue;
    rows.push({
      email: m[1].trim().toLowerCase(),
      name: (m[3] != null ? m[3] : m[2] || '').replace(/""/g, '"').trim(),
      otherNote: (m[5] != null ? m[5] : m[4] || '').replace(/""/g, '"'),
      claimUrl: (m[7] != null ? m[7] : m[6] || '').replace(/""/g, '"').trim(),
    });
  }
  return rows.filter((r) => r.email && r.email.includes('@') && r.claimUrl);
}

async function sendOne(row, toOverride) {
  const to = toOverride || row.email;
  const groupName = row.name || 'your group';
  const vars = mergeEmailPreviewVariables(
    SLUG,
    {
      ...campaignSiteVars(SITE),
      organiser_name: groupName,
      group_name: groupName,
      other_groups_note: row.otherNote || '',
      claim_url: row.claimUrl,
      support_email: REPLY_TO,
      logo_url: SITE + '/assets/logo-nav-transparent.png?v=20260823uk3',
    },
    SITE
  );
  return sendTemplatedEmail({
    slug: SLUG,
    to,
    subject: REMATCH_SUBJECT.replace(/\{\{organiser_name\}\}/g, groupName),
    variables: vars,
    skipEmailCheck: true,
    replyTo: REPLY_TO,
    resendTags: [
      { name: 'campaign', value: 'claim_rematch_prelaunch' },
      { name: 'segment', value: 'networking_groups_unclaimed' },
    ],
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  const allRows = parseCsv(CSV);
  const slice =
    limit > 0 ? allRows.slice(offset, offset + limit) : allRows.slice(offset);

  console.log('From:', process.env.RESEND_FROM || '(RESEND_FROM / default)');
  console.log('Reply-to:', REPLY_TO);
  console.log('Template:', SLUG);
  console.log('Subject:', REMATCH_SUBJECT);
  console.log('CSV recipients:', allRows.length);
  console.log('This run:', slice.length, '(offset', offset + (limit ? ', limit ' + limit : '') + ')');
  console.log('Audience: unclaimed networking groups only (not the ~3500 list)');

  if (!process.env.RESEND_API_KEY && (doSend || testTo)) {
    throw new Error('RESEND_API_KEY is not set');
  }

  if (testTo) {
    const sample = slice[0] || allRows[0];
    if (!sample) throw new Error('CSV empty — rebuild the list first');
    console.log('Test send to', testTo, 'using sample group:', sample.name);
    const result = await sendOne(sample, testTo);
    console.log('Sent', result && result.id);
    return;
  }

  if (!doSend) {
    console.log('Dry-run. First 8:');
    slice.slice(0, 8).forEach((r) => console.log('  ', r.email, '—', r.name));
    console.log('\nTest:  node scripts/send-claim-rematch-resend.js --test catherine@thenetworkeruk.com');
    console.log('Send:  node scripts/send-claim-rematch-resend.js --send --limit=50');
    console.log('Full:  node scripts/send-claim-rematch-resend.js --send');
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const row of slice) {
    try {
      const result = await sendOne(row);
      ok += 1;
      console.log('OK', row.email, result && result.id);
      await sleep(120);
    } catch (e) {
      fail += 1;
      console.error('FAIL', row.email, e.message || e);
      await sleep(250);
    }
  }
  console.log('Done. Sent', ok, 'failed', fail);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
