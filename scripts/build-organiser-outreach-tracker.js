#!/usr/bin/env node
/**
 * Build / refresh the month-1 organiser outreach tracker (ops CRM-lite).
 * Lives outside Command Centre — import the CSV into Google Sheets and work there.
 *
 * Usage:
 *   node scripts/build-organiser-outreach-tracker.js
 *   node scripts/build-organiser-outreach-tracker.js --out=ops/organiser-outreach-tracker.csv
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (local.env).
 *
 * Hub columns are refreshed from Supabase. Manual outreach columns on an existing
 * file are preserved by organiser_id (fallback: email + group_name).
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env') });

const { getSupabaseAdmin } = require('../api/_lib/supabase');
const { isPublicOrganiser } = require('../api/_lib/supabase-organisers-browse');

const SITE = 'https://www.thenetworkerhub.com';
const DEFAULT_OUT = path.join(root, 'ops/organiser-outreach-tracker.csv');
const PHONE_CSV = path.join(root, 'data/networking-groups-organisers.csv');

const SKIP_EMAILS = new Set([
  'pips249@gmail.com',
  'hello@thenetworkerhub.com',
  'catherine@thenetworkerhub.com',
  'rosie@thenetworkerhub.com',
]);

/** Manual columns — never overwritten on refresh. */
const MANUAL_COLS = [
  'priority',
  'email_1_sent',
  'email_2_sent',
  'last_called',
  'last_emailed',
  'next_action',
  'outcome',
  'owner',
  'notes',
];

const HUB_COLS = [
  'organiser_id',
  'group_name',
  'slug',
  'email',
  'phone',
  'claim_status',
  'has_hub_account',
  'profile_url',
  'claim_url',
  'refreshed_at',
];

const HEADER = [...HUB_COLS, ...MANUAL_COLS];

function normEmail(v) {
  return String(v || '')
    .trim()
    .toLowerCase();
}

function isInternalTest(name, email) {
  if (SKIP_EMAILS.has(email)) return true;
  if (/@example\.com$/i.test(email)) return true;
  if (/^e2e[- ]/i.test(name || '') || /\be2e\b/i.test(email)) return true;
  if (/pip'?s test|testing category|rosie posy|the networker hub$/i.test(name || '')) return true;
  return false;
}

function isExhibition(name) {
  return /exhibition|trade show|\bsummit\b|\bexpo\b|festival|awards night/i.test(name || '');
}

function esc(v) {
  const s = String(v == null ? '' : v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function parseArgs(argv) {
  const out = { out: DEFAULT_OUT };
  for (const a of argv.slice(2)) {
    if (a.startsWith('--out=')) out.out = path.resolve(root, a.slice('--out='.length));
  }
  return out;
}

/** Minimal CSV parser for our own tracker + phone source. */
function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.length);
  if (!lines.length) return { header: [], rows: [] };
  const split = (line) => {
    const cols = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else if (c === '"') {
          inQ = false;
        } else {
          cur += c;
        }
      } else if (c === '"') {
        inQ = true;
      } else if (c === ',') {
        cols.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
    cols.push(cur);
    return cols;
  };
  const header = split(lines[0]).map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = split(lines[i]);
    const obj = {};
    header.forEach((h, idx) => {
      obj[h] = cols[idx] != null ? cols[idx] : '';
    });
    rows.push(obj);
  }
  return { header, rows };
}

function loadPhoneByEmail() {
  const map = new Map();
  if (!fs.existsSync(PHONE_CSV)) return map;
  const { rows } = parseCsv(fs.readFileSync(PHONE_CSV, 'utf8'));
  for (const r of rows) {
    const email = normEmail(r.email);
    const phone = String(r.phone || '').trim();
    if (email && phone && !map.has(email)) map.set(email, phone);
  }
  return map;
}

function loadExistingManual(outPath) {
  const byId = new Map();
  const byKey = new Map();
  if (!fs.existsSync(outPath)) return { byId, byKey };
  const { rows } = parseCsv(fs.readFileSync(outPath, 'utf8'));
  for (const r of rows) {
    const manual = {};
    for (const c of MANUAL_COLS) manual[c] = r[c] != null ? r[c] : '';
    const id = String(r.organiser_id || '').trim();
    if (id) byId.set(id, manual);
    const key =
      normEmail(r.email) + '|' + String(r.group_name || '').trim().toLowerCase();
    if (key !== '|') byKey.set(key, manual);
  }
  return { byId, byKey };
}

async function fetchAllOrganisers(sb) {
  const pageSize = 1000;
  let from = 0;
  const all = [];
  while (true) {
    const { data, error } = await sb
      .from('organisers')
      .select(
        'id, name, slug, contact_email, email, phone, ownership_claim_status, listing_status, verification_status'
      )
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

async function existingAccountEmails(sb) {
  const emails = new Set();
  let page = 1;
  const perPage = 1000;
  while (page <= 50) {
    const { data: list, error } = await sb.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.warn('auth.admin.listUsers failed — has_hub_account may be blank:', error.message);
      return null;
    }
    (list.users || []).forEach((u) => {
      const e = normEmail(u.email);
      if (e) emails.add(e);
    });
    if (!list.users?.length || list.users.length < perPage) break;
    page += 1;
  }
  return emails;
}

function claimUrlFor(email, hasAccount) {
  const em = encodeURIComponent(email);
  const next = encodeURIComponent('/organiser/?onboard=claim');
  const intent = 'organiser-claim';
  if (hasAccount) {
    return SITE + '/login?email=' + em + '&next=' + next + '&intent=' + intent;
  }
  return SITE + '/register?email=' + em + '&next=' + next + '&intent=' + intent;
}

/** Ops-friendly labels (Hub stores pending = awaiting first-login claim). */
function claimStatusLabel(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  if (s === 'claimed') return 'claimed';
  if (s === 'disputed') return 'disputed';
  // pending or null → still needs outreach
  return 'awaiting_claim';
}

function emptyManual() {
  const o = {};
  for (const c of MANUAL_COLS) o[c] = '';
  return o;
}

(async () => {
  const args = parseArgs(process.argv);
  const sb = getSupabaseAdmin();
  if (!sb) {
    console.error('Supabase admin client unavailable — set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }

  const [organisers, accountEmails, phoneByEmail, existing] = await Promise.all([
    fetchAllOrganisers(sb),
    existingAccountEmails(sb),
    Promise.resolve(loadPhoneByEmail()),
    Promise.resolve(loadExistingManual(args.out)),
  ]);

  const refreshedAt = new Date().toISOString().slice(0, 10);
  const rows = [];

  for (const r of organisers) {
    const email = normEmail(r.contact_email || r.email);
    if (!email.includes('@')) continue;
    if (isExhibition(r.name)) continue;
    if (isInternalTest(r.name, email)) continue;
    if (!isPublicOrganiser(r)) continue;

    const name = String(r.name || '').trim();
    const slug = String(r.slug || '').trim();
    const id = String(r.id || '').trim();
    const phone = String(r.phone || '').trim() || phoneByEmail.get(email) || '';
    const hasAccount = accountEmails ? accountEmails.has(email) : '';
    const claimStatus = claimStatusLabel(r.ownership_claim_status);

    let manual = emptyManual();
    if (id && existing.byId.has(id)) {
      manual = existing.byId.get(id);
    } else {
      const key = email + '|' + name.toLowerCase();
      if (existing.byKey.has(key)) manual = existing.byKey.get(key);
    }

    // If Hub says claimed, nudge outcome unless already set to something else useful
    if (claimStatus === 'claimed' && !String(manual.outcome || '').trim()) {
      manual = { ...manual, outcome: 'claimed' };
    }

    rows.push({
      organiser_id: id,
      group_name: name,
      slug,
      email,
      phone,
      claim_status: claimStatus,
      has_hub_account: hasAccount === '' ? '' : hasAccount ? 'yes' : 'no',
      profile_url: slug ? SITE + '/organisers/' + encodeURIComponent(slug) : '',
      claim_url: claimUrlFor(email, !!hasAccount),
      refreshed_at: refreshedAt,
      ...manual,
    });
  }

  const statusRank = { awaiting_claim: 0, disputed: 1, claimed: 2 };
  rows.sort((a, b) => {
    const ra = statusRank[a.claim_status] ?? 9;
    const rb = statusRank[b.claim_status] ?? 9;
    if (ra !== rb) return ra - rb;
    // Phone rows first within status — easier call lists
    if (!!a.phone !== !!b.phone) return a.phone ? -1 : 1;
    return a.group_name.localeCompare(b.group_name, 'en-GB', { sensitivity: 'base' });
  });

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  const bom = '\uFEFF';
  const csv =
    bom +
    HEADER.join(',') +
    '\n' +
    rows.map((r) => HEADER.map((h) => esc(r[h])).join(',')).join('\n') +
    '\n';
  fs.writeFileSync(args.out, csv);

  const counts = { awaiting_claim: 0, claimed: 0, disputed: 0 };
  for (const r of rows) counts[r.claim_status] = (counts[r.claim_status] || 0) + 1;
  const withPhone = rows.filter((r) => r.phone).length;

  console.log('Wrote', path.relative(root, args.out));
  console.log('Groups:', rows.length);
  console.log('Claim status:', counts);
  console.log('With phone:', withPhone);
  console.log('Manual rows preserved:', existing.byId.size || existing.byKey.size);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
