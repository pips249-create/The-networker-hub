#!/usr/bin/env node
/**
 * Build the pre-launch claim rematch list for Resend.
 *
 * Audience: unclaimed **networking group** organiser profiles only
 * (Segment A rules) — not the ~3,500 Brevo/attendee contact database.
 *
 * Usage:
 *   node scripts/build-claim-rematch-resend.js
 *
 * Outputs:
 *   data/Claim-Rematch-Resend.csv              full list
 *   data/Claim-Rematch-Resend-batch-NN.csv      50-email chunks for Command Centre
 *   data/Claim-Rematch-Resend-summary.json
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env.local') });
dotenv.config({ path: path.join(root, '.env') });

const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');
const { resolveOrganiserClaimUrl, previewClaimUrl } = require('../api/_lib/organiser-claim-url');
const { isPublicOrganiser } = require('../api/_lib/supabase-organisers-browse');
const { publicOrganiserSlug } = require('../api/_lib/organiser-slug');
const { isExcludedLaunchOrganiser } = require('./launch-excluded-organisers');

const SITE = 'https://www.thenetworkeruk.com';
const BATCH = 50;
const OUT_CSV = path.join(root, 'data/Claim-Rematch-Resend.csv');
const OUT_SUMMARY = path.join(root, 'data/Claim-Rematch-Resend-summary.json');

const SKIP_EMAILS = new Set([
  'pips249@gmail.com',
  'hi@thenetworkeruk.com',
  'catherine@thenetworkeruk.com',
  'rosie@thenetworkeruk.com',
]);

function isInternalTest(name, email, row) {
  if (SKIP_EMAILS.has(email)) return true;
  if (row && (row.is_internal === true || row.is_internal === 'true')) return true;
  if (isExcludedLaunchOrganiser({ email, name })) return true;
  if (/pip'?s test|testing category|rosie posy|the networker hub$/i.test(name || '')) return true;
  return false;
}

function isExhibition(name) {
  return /exhibition|trade show|\bsummit\b|\bexpo\b|festival|awards night/i.test(name || '');
}

function esc(v) {
  return '"' + String(v || '').replace(/"/g, '""') + '"';
}

function otherGroupsNote(extraGroups) {
  if (!extraGroups.length) return '';
  if (extraGroups.length === 1) return ', plus ' + extraGroups[0];
  if (extraGroups.length === 2) return ', plus ' + extraGroups[0] + ' and ' + extraGroups[1];
  return (
    ', plus ' +
    extraGroups.slice(0, -1).join(', ') +
    ', and ' +
    extraGroups[extraGroups.length - 1]
  );
}

async function fetchAllOrganisers(sb) {
  const pageSize = 1000;
  let from = 0;
  const all = [];
  while (true) {
    const { data, error } = await sb
      .from('organisers')
      .select(
        'id, name, slug, contact_email, email, listing_status, verification_status, ownership_claim_status, is_internal'
      )
      .order('name')
      .range(from, from + pageSize - 1);
    if (error) {
      // Older DBs may lack is_internal — retry without it.
      if (/is_internal/i.test(String(error.message || ''))) {
        const retry = await sb
          .from('organisers')
          .select(
            'id, name, slug, contact_email, email, listing_status, verification_status, ownership_claim_status'
          )
          .order('name')
          .range(from, from + pageSize - 1);
        if (retry.error) throw retry.error;
        if (!retry.data || !retry.data.length) break;
        all.push(...retry.data);
        if (retry.data.length < pageSize) break;
        from += pageSize;
        continue;
      }
      throw error;
    }
    if (!data || !data.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

/** Emails that have actually signed in (know their password). Silent imports do not count. */
async function signedInAccountEmails(sb) {
  const emails = new Set();
  let page = 1;
  const perPage = 1000;
  while (page <= 50) {
    const { data: list, error } = await sb.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.warn('auth.admin.listUsers failed — will resolve claim URLs individually:', error.message);
      return null;
    }
    (list.users || []).forEach((u) => {
      const e = String(u.email || '')
        .trim()
        .toLowerCase();
      if (e && u.last_sign_in_at) emails.add(e);
    });
    if (!list.users?.length || list.users.length < perPage) break;
    page += 1;
  }
  return emails;
}

function claimUrlFor(email, hasAccount, slug) {
  // Match Email 2: always open register first; existing users use “Already have an account?”
  return previewClaimUrl(SITE, email, 'register', slug);
}

function writeCsv(file, rows) {
  const bom = '\uFEFF';
  const body =
    bom +
    'Email,Organiser name,OTHER_GROUPS_NOTE,CLAIM_URL,Group count,Has account\n' +
    rows
      .map(
        (r) =>
          r.email +
          ',' +
          esc(r.name) +
          ',' +
          esc(r.otherNote) +
          ',' +
          esc(r.claimUrl) +
          ',' +
          String(r.groupCount) +
          ',' +
          (r.hasAccount == null ? '' : r.hasAccount ? 'yes' : 'no')
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
  const organisers = await fetchAllOrganisers(sb);
  const accountEmails = await signedInAccountEmails(sb);

  let skippedClaimed = 0;
  let skippedDisputed = 0;
  let skippedExhibition = 0;
  let skippedInternal = 0;
  let skippedNotPublic = 0;
  let skippedNoEmail = 0;

  const byEmail = new Map();
  for (const r of organisers) {
    const email = String(r.contact_email || r.email || '')
      .trim()
      .toLowerCase();
    if (!email.includes('@')) {
      skippedNoEmail += 1;
      continue;
    }
    const name = String(r.name || '').trim();
    const slug = publicOrganiserSlug(r) || '';
    const claimStatus = String(r.ownership_claim_status || '')
      .trim()
      .toLowerCase();

    if (claimStatus === 'claimed') {
      skippedClaimed += 1;
      continue;
    }
    if (claimStatus === 'disputed') {
      skippedDisputed += 1;
      continue;
    }
    if (isExhibition(name)) {
      skippedExhibition += 1;
      continue;
    }
    if (isInternalTest(name, email, r)) {
      skippedInternal += 1;
      continue;
    }
    if (!isPublicOrganiser(r)) {
      skippedNotPublic += 1;
      continue;
    }
    if (isExcludedLaunchOrganiser({ email, slug, name })) {
      skippedInternal += 1;
      continue;
    }

    if (!byEmail.has(email)) {
      byEmail.set(email, { email, groups: [] });
    }
    if (name) byEmail.get(email).groups.push({ name, slug });
  }

  const rows = [];
  for (const r of byEmail.values()) {
    const groups = [...r.groups]
      .filter((g, i, arr) => arr.findIndex((x) => x.name === g.name) === i)
      .sort((a, b) => a.name.localeCompare(b.name, 'en-GB', { sensitivity: 'base' }));
    const primarySlug = (groups.find((g) => g.slug) || {}).slug || '';
    let url;
    if (accountEmails) {
      url = claimUrlFor(r.email, accountEmails.has(r.email), primarySlug);
    } else {
      url = await resolveOrganiserClaimUrl(r.email, SITE, primarySlug);
    }
    rows.push({
      email: r.email,
      name: (groups[0] && groups[0].name) || r.email,
      otherNote: otherGroupsNote(groups.slice(1).map((g) => g.name)),
      claimUrl: url,
      groupCount: groups.length,
      hasAccount: accountEmails ? accountEmails.has(r.email) : null,
      slug: primarySlug,
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, 'en-GB', { sensitivity: 'base' }));

  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  writeCsv(OUT_CSV, rows);

  // Wipe previous batch files, then write fresh 50-packs for Command Centre.
  const dataDir = path.join(root, 'data');
  fs.readdirSync(dataDir)
    .filter((f) => /^Claim-Rematch-Resend-batch-\d+\.csv$/i.test(f))
    .forEach((f) => fs.unlinkSync(path.join(dataDir, f)));

  const batchFiles = [];
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const n = String(Math.floor(i / BATCH) + 1).padStart(2, '0');
    const file = path.join(dataDir, 'Claim-Rematch-Resend-batch-' + n + '.csv');
    writeCsv(file, chunk);
    batchFiles.push(path.basename(file));
  }

  const summary = {
    generated_at: new Date().toISOString(),
    audience: 'unclaimed_networking_group_organisers',
    not_included: [
      'attendee-only contacts',
      'full ~3500 Brevo list',
      'claimed organisers',
      'disputed organisers',
      'exhibition / trade-show style names',
      'internal / test / launch-excluded emails',
    ],
    recipients: rows.length,
    with_extra_group_pages: rows.filter((r) => r.otherNote).length,
    with_organiser_slug: rows.filter((r) => r.slug).length,
    already_signed_in: accountEmails ? rows.filter((r) => r.hasAccount).length : null,
    need_register: accountEmails ? rows.filter((r) => !r.hasAccount).length : null,
    skipped: {
      claimed: skippedClaimed,
      disputed: skippedDisputed,
      exhibition: skippedExhibition,
      internal_or_excluded: skippedInternal,
      not_public: skippedNotPublic,
      no_email: skippedNoEmail,
    },
    files: {
      full_csv: path.basename(OUT_CSV),
      batches: batchFiles,
      batch_size: BATCH,
    },
    send: {
      template: 'organiser_claim_invite',
      via: 'Resend (scripts/send-claim-rematch-resend.js) or Command Centre Campaigns (50/batch)',
      reply_to: 'catherine@thenetworkeruk.com',
    },
  };
  fs.writeFileSync(OUT_SUMMARY, JSON.stringify(summary, null, 2) + '\n');

  console.log('Wrote', path.relative(root, OUT_CSV));
  console.log('Wrote', batchFiles.length, 'batch CSV(s) of up to', BATCH);
  console.log('Wrote', path.relative(root, OUT_SUMMARY));
  console.log('Recipients (unclaimed networking groups):', rows.length);
  console.log('Skipped claimed:', skippedClaimed);
  console.log('Skipped disputed:', skippedDisputed);
  console.log('Skipped exhibition:', skippedExhibition);
  console.log('Skipped internal/excluded:', skippedInternal);
  console.log('Skipped not public:', skippedNotPublic);
  if (accountEmails) {
    console.log('Already signed in:', summary.already_signed_in);
    console.log('Need register / set-password:', summary.need_register);
  }
  console.log('\nNext:');
  console.log('  node scripts/send-claim-rematch-resend.js --test catherine@thenetworkeruk.com');
  console.log('  node scripts/send-claim-rematch-resend.js --send');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
