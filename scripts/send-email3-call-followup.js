#!/usr/bin/env node
/**
 * Send Email 3 (optional-help follow-up) via Resend.
 *
 * Usage:
 *   node scripts/send-email3-call-followup.js              # dry-run
 *   node scripts/send-email3-call-followup.js --test you@example.com
 *   node scripts/send-email3-call-followup.js --send
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env') });

const { sendTemplatedEmail } = require('../api/_lib/send-template-email');
const { mergeEmailPreviewVariables } = require('../api/_lib/email-preview-variables');
const { campaignSiteVars } = require('../api/_lib/organiser-campaign-defaults');

const SITE = 'https://www.thenetworkerhub.com';
const BOOK_CALL = 'https://savvycal.com/TheNetworkerHub/website-preview';
const CSV = path.join(root, 'data/Email3-A-Segment.csv');
const SLUG = 'organiser_call_followup';

const args = process.argv.slice(2);
const doSend = args.includes('--send');
const testIdx = args.indexOf('--test');
const testTo = testIdx >= 0 ? String(args[testIdx + 1] || '').trim().toLowerCase() : '';

function parseCsv(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(Boolean).slice(1);
  const rows = [];
  for (const line of lines) {
    const m = line.match(/^([^,]+),("([^"]*)"|[^,]*),("([^"]*)"|[^,]*),("([^"]*)"|.*)$/);
    if (!m) continue;
    rows.push({
      email: m[1].trim().toLowerCase(),
      name: (m[3] != null ? m[3] : m[2] || '').replace(/""/g, '"'),
      otherNote: (m[5] != null ? m[5] : m[4] || '').replace(/""/g, '"'),
      claimUrl: (m[7] != null ? m[7] : m[6] || '').replace(/""/g, '"'),
    });
  }
  return rows;
}

async function sendOne(row, toOverride) {
  const to = toOverride || row.email;
  const vars = mergeEmailPreviewVariables(
    SLUG,
    {
      ...campaignSiteVars(SITE),
      group_name: row.name,
      other_groups_note: row.otherNote,
      claim_url: row.claimUrl,
      book_call_url: BOOK_CALL,
      support_email: 'catherine@thenetworkerhub.com',
    },
    SITE
  );
  return sendTemplatedEmail({
    slug: SLUG,
    to,
    variables: vars,
    skipEmailCheck: true,
    replyTo: 'catherine@thenetworkerhub.com',
    resendTags: [
      { name: 'campaign', value: 'email3_help' },
      { name: 'segment', value: 'a_openers' },
    ],
  });
}

(async () => {
  const rows = parseCsv(CSV);
  console.log('From:', process.env.RESEND_FROM || 'hello@mail.thenetworkerhub.com (default)');
  console.log('Reply-to: catherine@thenetworkerhub.com');
  console.log('Recipients in CSV:', rows.length);

  if (testTo) {
    const sample = rows[0];
    if (!sample) throw new Error('CSV empty');
    console.log('Test send to', testTo, 'using', sample.name);
    const result = await sendOne(sample, testTo);
    console.log('Sent', result && result.id);
    return;
  }

  if (!doSend) {
    console.log('Dry-run. First 5:');
    rows.slice(0, 5).forEach((r) => console.log('  ', r.email, '—', r.name));
    console.log('Send a test: node scripts/send-email3-call-followup.js --test catherine@thenetworkerhub.com');
    console.log('Send the 28: node scripts/send-email3-call-followup.js --send');
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const row of rows) {
    try {
      const result = await sendOne(row);
      ok += 1;
      console.log('OK', row.email, result && result.id);
    } catch (e) {
      fail += 1;
      console.error('FAIL', row.email, e.message || e);
    }
  }
  console.log('Done. Sent', ok, 'failed', fail);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
