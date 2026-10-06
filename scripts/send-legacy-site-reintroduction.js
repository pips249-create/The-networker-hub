#!/usr/bin/env node
/**
 * Reintroduce The Networker UK to the June 2026 the-networker.co.uk import.
 * Production rows have no airtable_id; that import landed on 4 and 23 June 2026.
 *
 * Usage:
 *   node scripts/send-legacy-site-reintroduction.js                         # dry-run
 *   node scripts/send-legacy-site-reintroduction.js --test you@example.com
 *   node scripts/send-legacy-site-reintroduction.js --send --limit=25
 *   node scripts/send-legacy-site-reintroduction.js --send
 *   node scripts/send-legacy-site-reintroduction.js --csv=data/list.csv     # email,name
 *   node scripts/send-legacy-site-reintroduction.js --respect-legacy-opt-in
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env.local') });
dotenv.config({ path: path.join(root, '.env') });

const { sendTemplatedEmail } = require('../api/_lib/send-template-email');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');
const { legacyCampaignFrom, LEGACY_REPLY_EMAIL } = require('../api/_lib/organiser-campaign-defaults');
const {
  LEGACY_MEMBER_INTRO_SLUG,
  legacyMemberIntroVars,
  firstName,
} = require('../api/_lib/legacy-member-intro');

const SITE = 'https://www.thenetworkeruk.com';
const REPLY_TO = 'catherine@thenetworkeruk.com';
const SUBJECT = 'The Networker UK is live — 6,500 events and counting';

const SKIP_EMAILS = new Set([
  'pips249@gmail.com',
  'hi@thenetworkeruk.com',
  'catherine@thenetworkeruk.com',
  'rosie@thenetworkeruk.com',
  'hello@the-networker.co.uk',
  'hello@thenetworkeruk.com',
]);

const args = process.argv.slice(2);
const doSend = args.includes('--send');
const respectLegacyOptIn = args.includes('--respect-legacy-opt-in');
const testIdx = args.indexOf('--test');
const testTo = testIdx >= 0 ? String(args[testIdx + 1] || '').trim().toLowerCase() : '';

function argValue(name, fallback) {
  const hit = args.find((a) => a.startsWith('--' + name + '='));
  if (!hit) return fallback;
  return hit.slice(name.length + 3);
}

function argInt(name, fallback) {
  const raw = argValue(name, '');
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

const csvPath = argValue('csv', '');
const offset = Math.max(0, argInt('offset', 0));
const limit = argInt('limit', 0);

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function parseCsv(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  const emailIdx = header.findIndex((h) => h === 'email' || h === 'e-mail');
  const nameIdx = header.findIndex((h) => h === 'name' || h === 'full name' || h === 'firstname');
  if (emailIdx < 0) throw new Error('CSV needs an email column');
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const email = String(cols[emailIdx] || '').trim().toLowerCase();
    if (!isEmail(email)) continue;
    rows.push({
      email,
      name: nameIdx >= 0 ? cols[nameIdx] : '',
      marketingOptIn: null,
      supabaseUserId: null,
      hasAccount: false,
    });
  }
  return rows;
}

async function loadLegacyAttendees() {
  if (!isSupabaseConfigured()) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or pass --csv=');
  }
  const sb = getSupabaseAdmin();
  const rows = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await sb
      .from('attendees')
      .select('email, name, marketing_opt_in, supabase_user_id, created_at')
      .gte('created_at', '2026-06-01T00:00:00.000Z')
      .lt('created_at', '2026-07-01T00:00:00.000Z')
      .order('email', { ascending: true })
      .range(from, from + page - 1);
    if (error) throw new Error(error.message || 'attendees_query_failed');
    rows.push(...(data || []));
    if (!data || data.length < page) break;
  }
  return rows.map((row) => ({
    email: String(row.email || '').trim().toLowerCase(),
    name: row.name || '',
    marketingOptIn: row.marketing_opt_in === true,
    supabaseUserId: row.supabase_user_id || null,
    hasAccount: Boolean(row.supabase_user_id),
  }));
}

async function optedOutUserIds(userIds) {
  const ids = [...new Set(userIds.filter(Boolean))];
  const blocked = new Set();
  if (!ids.length || !isSupabaseConfigured()) return blocked;
  const sb = getSupabaseAdmin();
  const chunk = 80;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const { data, error } = await sb
      .from('hub_accounts')
      .select('user_id, emails_enabled')
      .in('user_id', slice);
    if (error) {
      if (/emails_enabled/i.test(error.message || '')) return blocked;
      throw new Error(error.message || 'hub_accounts_query_failed');
    }
    (data || []).forEach((row) => {
      if (row.emails_enabled === false) blocked.add(row.user_id);
    });
  }
  return blocked;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function prepareAudience() {
  const source = csvPath
    ? parseCsv(path.isAbsolute(csvPath) ? csvPath : path.join(root, csvPath))
    : await loadLegacyAttendees();
  const blockedUsers = await optedOutUserIds(source.map((row) => row.supabaseUserId));
  const seen = new Set();
  const kept = [];
  const stats = {
    source: source.length,
    invalid: 0,
    duplicate: 0,
    internal: 0,
    hubOptOut: 0,
    legacyOptOut: 0,
    kept: 0,
    legacyOptIn: 0,
    withAccount: 0,
  };

  source.forEach((row) => {
    const email = String(row.email || '').trim().toLowerCase();
    if (!isEmail(email)) {
      stats.invalid += 1;
      return;
    }
    if (seen.has(email)) {
      stats.duplicate += 1;
      return;
    }
    seen.add(email);
    if (row.marketingOptIn === true) stats.legacyOptIn += 1;
    if (SKIP_EMAILS.has(email) || /@(thenetworkeruk\.com|the-networker\.co\.uk)$/i.test(email)) {
      stats.internal += 1;
      return;
    }
    if (row.supabaseUserId && blockedUsers.has(row.supabaseUserId)) {
      stats.hubOptOut += 1;
      return;
    }
    if (respectLegacyOptIn && row.marketingOptIn !== true) {
      stats.legacyOptOut += 1;
      return;
    }
    if (row.hasAccount) stats.withAccount += 1;
    kept.push({ email, name: row.name || '', hasAccount: Boolean(row.hasAccount) });
  });
  stats.kept = kept.length;
  return { rows: kept, stats };
}

async function sendOne(row, toOverride) {
  const to = toOverride || row.email;
  const vars = legacyMemberIntroVars(SITE, row.name, { hasAccount: row.hasAccount });
  const day = new Date().toISOString().slice(0, 10);
  const emailKey = String(to)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._+-]+/g, '-');
  return sendTemplatedEmail({
    slug: LEGACY_MEMBER_INTRO_SLUG,
    to,
    subject: SUBJECT,
    variables: {
      ...vars,
      user_name: firstName(row.name),
      support_email: 'hi@thenetworkeruk.com',
    },
    skipEmailCheck: true,
    from: process.env.RESEND_FROM_LEGACY ? legacyCampaignFrom() : undefined,
    replyTo: REPLY_TO || LEGACY_REPLY_EMAIL,
    idempotencyKey: ('legacy-intro-' + emailKey + '-' + day).slice(0, 256),
    resendTags: [
      { name: 'campaign', value: 'legacy_site_reintroduction' },
      { name: 'segment', value: 'old_site_users' },
    ],
  });
}

(async () => {
  const { rows, stats } = await prepareAudience();
  const slice = limit > 0 ? rows.slice(offset, offset + limit) : rows.slice(offset);

  console.log('From:', process.env.RESEND_FROM_LEGACY ? legacyCampaignFrom() : process.env.RESEND_FROM || 'The Networker UK <hello@mail.thenetworkeruk.com>');
  console.log('Reply-to:', REPLY_TO);
  console.log('Template:', LEGACY_MEMBER_INTRO_SLUG);
  console.log('Subject:', SUBJECT);
  console.log('Source rows:', stats.source);
  console.log('Ready to send:', stats.kept, '(already have an account:', stats.withAccount + ')');
  console.log(
    'Skipped — invalid',
    stats.invalid,
    '· duplicate',
    stats.duplicate,
    '· internal',
    stats.internal,
    '· hub emails off',
    stats.hubOptOut,
    (respectLegacyOptIn ? '· legacy opt-in off ' + stats.legacyOptOut : '')
  );
  console.log('Airtable marketing_opt_in = true:', stats.legacyOptIn);
  console.log('This run:', slice.length, '(offset', offset + (limit ? ', limit ' + limit : '') + ')');

  if (!process.env.RESEND_API_KEY && (doSend || testTo)) {
    throw new Error('RESEND_API_KEY is not set');
  }

  if (testTo) {
    const sampleName = firstName(testTo.split('@')[0].replace(/[._].*$/, ''));
    const sample = { ...(rows[0] || { email: testTo, hasAccount: false }), name: sampleName };
    console.log('Test send to', testTo, 'greeting', sampleName);
    const result = await sendOne(sample, testTo);
    console.log('Sent', result && result.id);
    return;
  }

  if (!doSend) {
    console.log('\nDry run. First 8:');
    slice.slice(0, 8).forEach((row) => console.log(' ', row.email, '—', firstName(row.name)));
    if (slice.length > 8) console.log('  ... and', slice.length - 8, 'more');
    console.log('\nTest: node scripts/send-legacy-site-reintroduction.js --test catherine@thenetworkeruk.com');
    console.log('Send: node scripts/send-legacy-site-reintroduction.js --send');
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const row of slice) {
    try {
      const result = await sendOne(row);
      sent += 1;
      console.log('Sent', sent + '/' + slice.length, row.email, result && result.id);
      await sleep(600);
    } catch (err) {
      failed += 1;
      console.error('Failed', row.email, err.message || err);
    }
  }
  console.log('Done. Sent:', sent, 'Failed:', failed);
})().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
