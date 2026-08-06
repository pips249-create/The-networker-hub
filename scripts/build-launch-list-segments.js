#!/usr/bin/env node
/**
 * Classify launch contacts: organisers / hub accounts / both / attendees-only.
 * Optional: merge a Brevo CSV export (--brevo=path).
 *
 * Usage:
 *   node scripts/build-launch-list-segments.js
 *   node scripts/build-launch-list-segments.js --brevo=data/brevo-full-list.csv
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (local.env).
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env') });

const { getSupabaseAdmin } = require('../api/_lib/supabase');
const { isPublicOrganiser } = require('../api/_lib/supabase-organisers-browse');

const SKIP_EMAILS = new Set([
  'pips249@gmail.com',
  'hello@thenetworkerhub.com',
  'catherine@thenetworkerhub.com',
  'rosie@thenetworkerhub.com',
]);

function normEmail(v) {
  return String(v || '')
    .trim()
    .toLowerCase();
}

function isInternalTest(name, email) {
  if (SKIP_EMAILS.has(email)) return true;
  if (/pip'?s test|testing category|rosie posy|the networker hub$/i.test(name || '')) return true;
  return false;
}

function isExhibition(name) {
  return /exhibition|trade show|\bsummit\b|\bexpo\b|festival|awards night/i.test(name || '');
}

function esc(v) {
  return '"' + String(v || '').replace(/"/g, '""') + '"';
}

function parseArgs(argv) {
  const out = { brevo: null };
  for (const a of argv.slice(2)) {
    if (a.startsWith('--brevo=')) out.brevo = a.slice('--brevo='.length);
  }
  return out;
}

function readEmailColumn(csvPath) {
  const text = fs.readFileSync(csvPath, 'utf8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim().toLowerCase());
  let idx = header.findIndex((h) => h === 'email' || h === 'email address' || h === 'e-mail');
  if (idx < 0) idx = 0;
  const emails = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].match(/("([^"]|"")*"|[^,]*)/g) || [];
    const raw = (cols[idx] || '').replace(/^"|"$/g, '').replace(/""/g, '"');
    const e = normEmail(raw);
    if (e && e.includes('@')) emails.push(e);
  }
  return emails;
}

async function fetchAllOrganisers(sb) {
  const pageSize = 1000;
  let from = 0;
  const all = [];
  while (true) {
    const { data, error } = await sb
      .from('organisers')
      .select('id, name, slug, contact_email, email, listing_status, verification_status')
      .order('name')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || !data.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function fetchHubAccountEmails(sb) {
  // hub_accounts has no email column — join Auth users + optional attendees display name.
  const emails = new Map();
  const accountsByUser = new Map();
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await sb
      .from('hub_accounts')
      .select('user_id, display_name, created_at, emails_enabled')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || !data.length) break;
    for (const row of data) {
      if (row.user_id) accountsByUser.set(row.user_id, row);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const attendeeByUser = new Map();
  from = 0;
  while (true) {
    const { data, error } = await sb
      .from('attendees')
      .select('supabase_user_id, name, email')
      .range(from, from + pageSize - 1);
    if (error) {
      console.warn('attendees query skipped:', error.message);
      break;
    }
    if (!data || !data.length) break;
    for (const row of data) {
      if (row.supabase_user_id) attendeeByUser.set(row.supabase_user_id, row);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }

  let page = 1;
  const perPage = 1000;
  while (page <= 50) {
    const { data: list, error } = await sb.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error('auth.admin.listUsers: ' + error.message);
    for (const u of list.users || []) {
      const e = normEmail(u.email);
      if (!e) continue;
      const account = accountsByUser.get(u.id);
      const attendee = attendeeByUser.get(u.id);
      if (!emails.has(e)) {
        emails.set(e, {
          email: e,
          name: (account && account.display_name) || (attendee && attendee.name) || '',
          created_at: (account && account.created_at) || u.created_at || '',
          has_hub_account: Boolean(account),
        });
      }
    }
    if (!list.users?.length || list.users.length < perPage) break;
    page += 1;
  }
  return emails;
}

function writeCsv(filePath, rows, columns) {
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => esc(row[c] || '')).join(','));
  }
  fs.writeFileSync(filePath, lines.join('\n') + '\n');
}

async function main() {
  const args = parseArgs(process.argv);
  const sb = getSupabaseAdmin();
  if (!sb) {
    console.error('Supabase admin client unavailable — set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }

  const organisers = await fetchAllOrganisers(sb);
  const organiserByEmail = new Map();
  for (const o of organisers) {
    if (!isPublicOrganiser(o)) continue;
    const email = normEmail(o.contact_email || o.email);
    if (!email || !email.includes('@')) continue;
    if (isInternalTest(o.name, email) || isExhibition(o.name)) continue;
    const prev = organiserByEmail.get(email);
    if (!prev) {
      organiserByEmail.set(email, {
        email,
        organiser_name: o.name || '',
        slug: o.slug || '',
        other_groups: '',
      });
    } else {
      const extra = o.name || o.slug || '';
      if (extra && !prev.other_groups.includes(extra)) {
        prev.other_groups = prev.other_groups ? prev.other_groups + '; ' + extra : extra;
      }
    }
  }

  const hubByEmail = await fetchHubAccountEmails(sb);

  const organisersRows = [...organiserByEmail.values()].sort((a, b) =>
    a.organiser_name.localeCompare(b.organiser_name)
  );
  const hubRows = [...hubByEmail.values()].sort((a, b) => a.email.localeCompare(b.email));

  const bothRows = [];
  const attendeesOnly = [];
  for (const [email, hub] of hubByEmail) {
    if (organiserByEmail.has(email)) {
      const org = organiserByEmail.get(email);
      bothRows.push({
        email,
        name: hub.name || org.organiser_name,
        organiser_name: org.organiser_name,
        slug: org.slug,
      });
    } else if (!SKIP_EMAILS.has(email)) {
      attendeesOnly.push(hub);
    }
  }

  const dataDir = path.join(root, 'data');
  writeCsv(path.join(dataDir, 'launch-segment-organisers.csv'), organisersRows, [
    'email',
    'organiser_name',
    'slug',
    'other_groups',
  ]);
  writeCsv(path.join(dataDir, 'launch-segment-hub-accounts.csv'), hubRows, ['email', 'name', 'created_at']);
  writeCsv(path.join(dataDir, 'launch-segment-both.csv'), bothRows, [
    'email',
    'name',
    'organiser_name',
    'slug',
  ]);
  writeCsv(path.join(dataDir, 'launch-segment-attendees-only.csv'), attendeesOnly, [
    'email',
    'name',
    'created_at',
  ]);

  const summary = {
    generated_at: new Date().toISOString(),
    organisers_unique: organisersRows.length,
    hub_accounts: hubRows.length,
    both: bothRows.length,
    attendees_only: attendeesOnly.length,
  };

  if (args.brevo) {
    const brevoPath = path.isAbsolute(args.brevo) ? args.brevo : path.join(root, args.brevo);
    if (!fs.existsSync(brevoPath)) {
      console.error('Brevo file not found:', brevoPath);
      process.exit(1);
    }
    const brevoEmails = [...new Set(readEmailColumn(brevoPath))];
    let brevoOrganiser = 0;
    let brevoBoth = 0;
    let brevoAttendeeOnly = 0;
    let brevoUnknown = 0;
    for (const e of brevoEmails) {
      const isOrg = organiserByEmail.has(e);
      const isHub = hubByEmail.has(e);
      if (isOrg && isHub) brevoBoth += 1;
      else if (isOrg) brevoOrganiser += 1;
      else if (isHub) brevoAttendeeOnly += 1;
      else brevoUnknown += 1;
    }
    summary.brevo_unique = brevoEmails.length;
    summary.brevo_organisers = brevoOrganiser;
    summary.brevo_both = brevoBoth;
    summary.brevo_attendees_only = brevoAttendeeOnly;
    summary.brevo_unmatched = brevoUnknown;
  }

  fs.writeFileSync(path.join(dataDir, 'launch-segment-summary.json'), JSON.stringify(summary, null, 2) + '\n');

  console.log('Launch list segments');
  console.log(JSON.stringify(summary, null, 2));
  console.log('\nWrote data/launch-segment-*.csv + launch-segment-summary.json');
  console.log('See docs/LAUNCH-LIST-SEGMENTS.md');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
