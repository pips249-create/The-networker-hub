#!/usr/bin/env node
/**
 * Email the unclaimed-page reminder to groups on the browse page that
 * have not claimed and have not been contacted in the last 7 days.
 * The default run only lists them. Nothing is emailed unless --send is passed.
 *
 * Usage:
 *   node scripts/send-unclaimed-stale-reminders.js            # dry-run
 *   node scripts/send-unclaimed-stale-reminders.js --send     # send all
 *   node scripts/send-unclaimed-stale-reminders.js --send --limit=20
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env.local') });
dotenv.config({ path: path.join(root, '.env') });

const { isSupabaseConfigured } = require('../api/_lib/supabase');
const {
  listStaleUnclaimedReminders,
  sendUnclaimedFollowups,
} = require('../api/_lib/organiser-unclaimed-reminders');

const args = process.argv.slice(2);
const doSend = args.includes('--send');

function argValue(name, fallback) {
  const hit = args.find((item) => item.startsWith('--' + name + '='));
  if (!hit) return fallback;
  const n = parseInt(hit.split('=')[1], 10);
  return Number.isFinite(n) ? n : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Add keys to local.env.');
  }
  if (doSend && !process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set.');
  }

  const { getSupabaseAdmin } = require('../api/_lib/supabase');
  const listed = await listStaleUnclaimedReminders(getSupabaseAdmin());
  const limit = Math.max(0, argValue('limit', 0));
  const ids = limit > 0 ? listed.ids.slice(0, limit) : listed.ids;

  console.log('Eligible:', listed.summary.eligible);
  console.log('Skipped:', JSON.stringify(listed.summary));
  console.log('This run:', ids.length);
  if (!doSend) {
    const preview = (listed.groups || []).filter((group) => ids.indexOf(group.id) !== -1);
    preview.forEach((group) => {
      console.log('WOULD EMAIL', group.name || group.id, group.email || '');
    });
    console.log('Dry-run only. No email was sent.');
    return;
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (let i = 0; i < ids.length; i += 1) {
    const result = await sendUnclaimedFollowups([ids[i]], { email: 'system@thenetworkeruk.com' });
    sent += result.sent.length;
    failed += result.failed.length;
    skipped += result.skipped.length;
    const row = result.sent[0] || result.failed[0] || result.skipped[0] || {};
    console.log(
      result.sent.length ? 'OK' : 'SKIP',
      i + 1 + '/' + ids.length,
      row.email || row.name || ids[i],
      result.failed[0] && result.failed[0].error ? result.failed[0].error : ''
    );
    await sleep(150);
  }
  console.log('Done. Sent', sent, 'skipped', skipped, 'failed', failed);
})().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
