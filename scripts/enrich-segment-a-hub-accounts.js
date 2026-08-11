#!/usr/bin/env node
/**
 * Enrich Segment A hub-account rows for activation outreach.
 *
 * Joins:
 *   - data/Segment-A-with-hub-accounts.csv (auth / never signed in)
 *   - data/segment-a-email1.csv (slug, send tracking, notes)
 *   - data/networking-groups-organisers.csv (phones)
 *   - Supabase organisers + event counts (profile completeness)
 *
 * Adds classifications: franchise/network, archetype, contact type, region guess,
 * best channel, activation priority.
 *
 * Usage:
 *   node scripts/enrich-segment-a-hub-accounts.js
 *   node scripts/enrich-segment-a-hub-accounts.js --out=data/Segment-A-hub-accounts-enriched.csv
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
const { REGION_SECTORS } = require('../api/_lib/uk-outcode');

const SITE = 'https://www.thenetworkerhub.com';
const DEFAULT_OUT = path.join(root, 'data/Segment-A-hub-accounts-enriched.csv');
const HUB_CSV = path.join(root, 'data/Segment-A-with-hub-accounts.csv');
const SEGMENT_CSV = path.join(root, 'data/segment-a-email1.csv');
const PHONE_CSV = path.join(root, 'data/networking-groups-organisers.csv');

const GENERIC_LOCALS = new Set([
  'info',
  'hello',
  'enquiries',
  'enquiry',
  'support',
  'contact',
  'admin',
  'office',
  'mail',
  'team',
  'president',
  'chairman',
  'chair',
  'secretary',
  'website',
  'membership',
  'members',
  'events',
  'networking',
  'reception',
  'general',
]);

/** Domain → franchise / network family. */
const FRANCHISE_DOMAINS = [
  [/bni\.co\.uk$/i, 'BNI'],
  [/bni\.com$/i, 'BNI'],
  [/wibn\.co\.uk$/i, 'WIBN'],
  [/4nonline\.biz$/i, '4Networking'],
  [/actioncoach\.co\.uk$/i, 'ActionCOACH'],
  [/progressivepropertynetwork\.co\.uk$/i, 'Progressive Property Network'],
  [/business-network\.co\.uk$/i, 'Business Network'],
];

const HEADER = [
  'email',
  'organiser_name',
  'slug',
  'profile_url',
  'claim_url',
  'phone',
  'contact_type',
  'best_channel',
  'activation_priority',
  'org_archetype',
  'franchise_network',
  'region_guess',
  'email_domain',
  'has_signed_in',
  'email_confirmed',
  'auth_created',
  'last_sign_in',
  'organiser_access_at',
  'claim_status',
  'listing_status',
  'website',
  'linkedin_url',
  'has_logo',
  'has_description',
  'events_live',
  'events_total',
  'profile_completeness',
  'missing_fields',
  'email_1_sent',
  'email_2_sent',
  'confirmed',
  'event_live_flag',
  'other_groups',
  'notes',
  'auth_user_id',
  'organiser_id',
  'enriched_at',
];

function normEmail(v) {
  return String(v || '')
    .trim()
    .toLowerCase();
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

function loadCsvMap(filePath, emailKey, build) {
  const map = new Map();
  if (!fs.existsSync(filePath)) return map;
  const { rows } = parseCsv(fs.readFileSync(filePath, 'utf8'));
  for (const r of rows) {
    const email = normEmail(r[emailKey]);
    if (!email || map.has(email)) continue;
    map.set(email, build(r));
  }
  return map;
}

function contactType(email) {
  const local = String(email.split('@')[0] || '')
    .toLowerCase()
    .replace(/[._+-].*$/, '');
  // Keep full local for exact generic match (info, enquiries) and prefix check
  const fullLocal = String(email.split('@')[0] || '').toLowerCase();
  if (GENERIC_LOCALS.has(fullLocal) || GENERIC_LOCALS.has(local)) return 'generic';
  return 'personal';
}

function franchiseNetwork(email, name) {
  const domain = email.split('@')[1] || '';
  for (const [re, label] of FRANCHISE_DOMAINS) {
    if (re.test(domain)) return label;
  }
  const n = String(name || '').toLowerCase();
  if (/\bbni\b/.test(n)) return 'BNI';
  if (/\bwibn\b/.test(n)) return 'WIBN';
  if (/\bbita\b/.test(n)) return 'BITA';
  if (/\b4n(etworking)?\b|\b4networking\b/.test(n)) return '4Networking';
  if (/action\s*coach|actioncoach/.test(n)) return 'ActionCOACH';
  if (/fore business/.test(n)) return 'Fore Business';
  if (/chamber of commerce|\bchamber\b/.test(n)) return 'Chamber';
  return 'Independent';
}

function orgArchetype(name, franchise) {
  const n = String(name || '').toLowerCase();
  if (/chamber of commerce|\bchamber\b/.test(n)) return 'chamber';
  if (/women|wibn|female|ladies|entrepreneurs in scotland|bawe\b|abw\b/.test(n)) return 'women_network';
  if (/growth hub/.test(n)) return 'growth_hub';
  if (franchise && franchise !== 'Independent' && franchise !== 'Chamber') return 'franchise_chapter';
  if (/business club|\bclub\b/.test(n)) return 'business_club';
  if (/network(ing)?/.test(n)) return 'networking_group';
  return 'other';
}

function regionFromName(name) {
  const text = String(name || '').toLowerCase();
  const keys = Object.keys(REGION_SECTORS).sort((a, b) => b.length - a.length);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const label = key.replace(/-/g, ' ');
    if (text.includes(label) || text.includes(key)) return key;
  }
  const hints = [
    ['central london', 'central-london'],
    ['north london', 'north-london'],
    ['south london', 'south-london'],
    ['east london', 'east-london'],
    ['west london', 'west-london'],
    ['london', 'central-london'],
    ['manchester', 'manchester'],
    ['birmingham', 'birmingham'],
    ['glasgow', 'glasgow'],
    ['edinburgh', 'edinburgh'],
    ['leeds', 'leeds'],
    ['liverpool', 'liverpool'],
    ['newcastle', 'newcastle'],
    ['bristol', 'bristol'],
    ['sheffield', 'sheffield'],
    ['nottingham', 'nottingham'],
    ['cardiff', 'cardiff'],
    ['brighton', 'brighton'],
    ['cambridge', 'cambridge'],
    ['oxford', 'oxford'],
    ['chester', 'chester'],
    ['belfast', 'belfast'],
    ['reading', 'reading'],
    ['leicester', 'leicester'],
    ['bournemouth', 'bournemouth'],
    ['southampton', 'southampton'],
    ['portsmouth', 'portsmouth'],
    ['norwich', 'norwich'],
    ['plymouth', 'plymouth'],
    ['swansea', 'swansea'],
    ['derby', 'derby'],
    ['bath', 'bath'],
    ['york', 'york'],
    ['hull', 'hull'],
    ['aberdeen', 'aberdeen'],
    ['dundee', 'dundee'],
    ['maidstone', 'maidstone'],
    ['cheltenham', 'cheltenham'],
    ['colchester', 'colchester'],
    ['ipswich', 'ipswich'],
    ['exeter', 'exeter'],
    ['durham', 'durham'],
    ['huddersfield', 'huddersfield'],
    ['bradford', 'bradford'],
    ['wakefield', 'leeds'],
    ['ayrshire', 'glasgow'],
    ['grampian', 'aberdeen'],
    ['kent', 'maidstone'],
    ['essex', 'colchester'],
    ['berkshire', 'reading'],
    ['bedfordshire', 'cambridge'],
    ['ilminster', 'exeter'],
    ['basingstoke', 'reading'],
    ['barnsley', 'sheffield'],
    ['rotherham', 'sheffield'],
  ];
  for (let i = 0; i < hints.length; i++) {
    if (text.includes(hints[i][0])) return hints[i][1];
  }
  return '';
}

function claimStatusLabel(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  if (s === 'claimed') return 'claimed';
  if (s === 'disputed') return 'disputed';
  return 'awaiting_claim';
}

function profileCompleteness(fields) {
  const checks = [
    ['website', !!fields.website],
    ['linkedin', !!fields.linkedin_url],
    ['logo', !!fields.has_logo],
    ['description', !!fields.has_description],
    ['phone', !!fields.phone],
    ['events', Number(fields.events_live) > 0],
  ];
  const present = checks.filter((c) => c[1]).length;
  const missing = checks.filter((c) => !c[1]).map((c) => c[0]);
  return {
    score: Math.round((present / checks.length) * 100),
    missing: missing.join('|'),
  };
}

function bestChannel({ phone, linkedin_url, contact_type }) {
  if (phone) return 'phone';
  if (linkedin_url) return 'linkedin';
  if (contact_type === 'personal') return 'personal_email';
  return 'generic_email';
}

/**
 * Higher = chase first among never-signed-in hub accounts.
 * Phone + personal email + incomplete profile + franchise = warm call list.
 */
function activationPriority(row) {
  let score = 0;
  if (row.phone) score += 40;
  if (row.contact_type === 'personal') score += 20;
  else score += 5;
  if (row.franchise_network && row.franchise_network !== 'Independent') score += 15;
  if (Number(row.profile_completeness) < 50) score += 10;
  if (Number(row.events_live) > 0) score += 10;
  if (row.linkedin_url) score += 5;
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function claimUrlFor(email, slug) {
  const em = encodeURIComponent(email);
  const next = encodeURIComponent('/organiser/?onboard=claim');
  if (slug) {
    return (
      SITE +
      '/organisers/' +
      encodeURIComponent(slug) +
      '?email=' +
      em +
      '&intent=organiser-claim&auth=login&next=' +
      next
    );
  }
  return SITE + '/login?email=' + em + '&next=' + next + '&intent=organiser-claim';
}

async function fetchOrganisersByEmail(sb, emails) {
  const byEmail = new Map();
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await sb
      .from('organisers')
      .select(
        'id, name, slug, contact_email, email, phone, website, linkedin_url, photo_url, description, ownership_claim_status, listing_status'
      )
      .order('name')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || !data.length) break;
    for (const r of data) {
      const email = normEmail(r.contact_email || r.email);
      if (!email || !emails.has(email)) continue;
      // Prefer row whose name matches later; first win is fine for map seed
      if (!byEmail.has(email)) byEmail.set(email, r);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return byEmail;
}

async function fetchEventCounts(sb, organiserIds) {
  const live = new Map();
  const total = new Map();
  if (!organiserIds.length) return { live, total };
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await sb
      .from('events')
      .select('organiser_id, approval_status')
      .in('organiser_id', organiserIds)
      .range(from, from + pageSize - 1);
    if (error) {
      // Fallback if approval_status naming differs — still return empty rather than fail hard
      console.warn('events count query failed:', error.message);
      return { live, total };
    }
    if (!data || !data.length) break;
    for (const ev of data) {
      const id = String(ev.organiser_id || '');
      if (!id) continue;
      total.set(id, (total.get(id) || 0) + 1);
      const status = String(ev.approval_status || '').toLowerCase();
      if (status === 'approved' || status === 'published') {
        live.set(id, (live.get(id) || 0) + 1);
      }
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return { live, total };
}

(async () => {
  const args = parseArgs(process.argv);
  if (!fs.existsSync(HUB_CSV)) {
    console.error('Missing', path.relative(root, HUB_CSV));
    process.exit(1);
  }

  const sb = getSupabaseAdmin();
  if (!sb) {
    console.error('Supabase admin client unavailable — set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }

  const { rows: hubRows } = parseCsv(fs.readFileSync(HUB_CSV, 'utf8'));
  const segmentByEmail = loadCsvMap(SEGMENT_CSV, 'email', (r) => ({
    slug: String(r.slug || '').trim(),
    other_groups: String(r.other_groups || '').trim(),
    email_1_sent: String(r.email_1_sent || '').trim(),
    email_2_sent: String(r.email_2_sent || '').trim(),
    confirmed: String(r.confirmed || '').trim(),
    event_live_flag: String(r.event_live || '').trim(),
    notes: String(r.notes || '').trim(),
    group: String(r.group || '').trim(),
  }));
  const phoneByEmail = loadCsvMap(PHONE_CSV, 'email', (r) => String(r.phone || '').trim());

  const emails = new Set(hubRows.map((r) => normEmail(r.Email || r.email)).filter(Boolean));
  const organisersByEmail = await fetchOrganisersByEmail(sb, emails);

  // Prefer organiser row matching segment slug / group name when multiple exist
  for (const email of emails) {
    const seg = segmentByEmail.get(email);
    if (!seg) continue;
    // Re-scan is expensive; current map is good enough — enrich name match below via segment slug lookup
  }

  // If we have slug on segment, try to attach that organiser preferentially
  const slugToOrg = new Map();
  for (const org of organisersByEmail.values()) {
    const slug = String(org.slug || '').trim();
    if (slug) slugToOrg.set(slug, org);
  }
  // Also fetch by slug for any missing
  const missingSlugs = [];
  for (const email of emails) {
    const seg = segmentByEmail.get(email);
    if (seg && seg.slug && !slugToOrg.has(seg.slug)) missingSlugs.push(seg.slug);
  }
  if (missingSlugs.length) {
    const { data: bySlug, error } = await sb
      .from('organisers')
      .select(
        'id, name, slug, contact_email, email, phone, website, linkedin_url, photo_url, description, ownership_claim_status, listing_status'
      )
      .in('slug', missingSlugs);
    if (error) console.warn('slug lookup failed:', error.message);
    else {
      for (const r of bySlug || []) {
        const slug = String(r.slug || '').trim();
        if (slug) slugToOrg.set(slug, r);
        const em = normEmail(r.contact_email || r.email);
        if (em && !organisersByEmail.has(em)) organisersByEmail.set(em, r);
      }
    }
  }

  const orgIds = [];
  const resolveOrg = (email, seg) => {
    if (seg && seg.slug && slugToOrg.has(seg.slug)) return slugToOrg.get(seg.slug);
    return organisersByEmail.get(email) || null;
  };
  for (const r of hubRows) {
    const email = normEmail(r.Email || r.email);
    const org = resolveOrg(email, segmentByEmail.get(email));
    if (org && org.id) orgIds.push(org.id);
  }
  const uniqueOrgIds = [...new Set(orgIds)];
  const eventCounts = await fetchEventCounts(sb, uniqueOrgIds);

  const enrichedAt = new Date().toISOString().slice(0, 10);
  const outRows = [];

  for (const r of hubRows) {
    const email = normEmail(r.Email || r.email);
    if (!email) continue;
    const name = String(r['Organiser name'] || r.organiser_name || '').trim();
    const seg = segmentByEmail.get(email) || {};
    const org = resolveOrg(email, seg);
    const slug = String((org && org.slug) || seg.slug || '').trim();
    const phone =
      String((org && org.phone) || '').trim() || phoneByEmail.get(email) || '';
    const website = String((org && org.website) || '').trim();
    const linkedin_url = String((org && org.linkedin_url) || '').trim();
    const has_logo = org && org.photo_url ? 'yes' : 'no';
    const has_description = org && String(org.description || '').trim() ? 'yes' : 'no';
    const orgId = org ? String(org.id || '') : '';
    const events_live = orgId ? eventCounts.live.get(orgId) || 0 : 0;
    const events_total = orgId ? eventCounts.total.get(orgId) || 0 : 0;
    const ctype = contactType(email);
    const franchise = franchiseNetwork(email, name);
    const completeness = profileCompleteness({
      website,
      linkedin_url,
      has_logo: has_logo === 'yes',
      has_description: has_description === 'yes',
      phone,
      events_live,
    });
    const channel = bestChannel({ phone, linkedin_url, contact_type: ctype });
    const draft = {
      phone,
      contact_type: ctype,
      franchise_network: franchise,
      profile_completeness: completeness.score,
      events_live,
      linkedin_url,
    };
    const priority = activationPriority(draft);

    outRows.push({
      email,
      organiser_name: name,
      slug,
      profile_url: slug ? SITE + '/organisers/' + encodeURIComponent(slug) : '',
      claim_url: claimUrlFor(email, slug),
      phone,
      contact_type: ctype,
      best_channel: channel,
      activation_priority: priority,
      org_archetype: orgArchetype(name, franchise),
      franchise_network: franchise,
      region_guess: regionFromName(name),
      email_domain: email.split('@')[1] || '',
      has_signed_in: String(r['Has signed in'] || '').trim(),
      email_confirmed: String(r['Email confirmed'] || '').trim(),
      auth_created: String(r['Auth created'] || '').trim(),
      last_sign_in: String(r['Last sign in'] || '').trim(),
      organiser_access_at: String(r['Organiser access at'] || '').trim(),
      claim_status: claimStatusLabel(org && org.ownership_claim_status),
      listing_status: String((org && org.listing_status) || '').trim(),
      website,
      linkedin_url,
      has_logo,
      has_description,
      events_live,
      events_total,
      profile_completeness: completeness.score,
      missing_fields: completeness.missing,
      email_1_sent: seg.email_1_sent || '',
      email_2_sent: seg.email_2_sent || '',
      confirmed: seg.confirmed || '',
      event_live_flag: seg.event_live_flag || '',
      other_groups: seg.other_groups || '',
      notes: seg.notes || '',
      auth_user_id: String(r['Auth user id'] || '').trim(),
      organiser_id: orgId,
      enriched_at: enrichedAt,
    });
  }

  const priorityRank = { high: 0, medium: 1, low: 2 };
  outRows.sort((a, b) => {
    const pa = priorityRank[a.activation_priority] ?? 9;
    const pb = priorityRank[b.activation_priority] ?? 9;
    if (pa !== pb) return pa - pb;
    if (!!a.phone !== !!b.phone) return a.phone ? -1 : 1;
    return a.organiser_name.localeCompare(b.organiser_name, 'en-GB', { sensitivity: 'base' });
  });

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  const csv =
    HEADER.join(',') +
    '\n' +
    outRows.map((r) => HEADER.map((h) => esc(r[h])).join(',')).join('\n') +
    '\n';
  fs.writeFileSync(args.out, csv);

  const counts = {
    high: 0,
    medium: 0,
    low: 0,
    with_phone: 0,
    with_slug: 0,
    with_website: 0,
    with_linkedin: 0,
    with_region: 0,
    hub_matched: 0,
    personal: 0,
    generic: 0,
  };
  const archetypes = {};
  const franchises = {};
  for (const r of outRows) {
    counts[r.activation_priority] += 1;
    if (r.phone) counts.with_phone += 1;
    if (r.slug) counts.with_slug += 1;
    if (r.website) counts.with_website += 1;
    if (r.linkedin_url) counts.with_linkedin += 1;
    if (r.region_guess) counts.with_region += 1;
    if (r.organiser_id) counts.hub_matched += 1;
    if (r.contact_type === 'personal') counts.personal += 1;
    else counts.generic += 1;
    archetypes[r.org_archetype] = (archetypes[r.org_archetype] || 0) + 1;
    franchises[r.franchise_network] = (franchises[r.franchise_network] || 0) + 1;
  }

  console.log('Wrote', path.relative(root, args.out));
  console.log('Rows:', outRows.length);
  console.log('Priority:', { high: counts.high, medium: counts.medium, low: counts.low });
  console.log('Coverage:', {
    phone: counts.with_phone,
    slug: counts.with_slug,
    website: counts.with_website,
    linkedin: counts.with_linkedin,
    region: counts.with_region,
    hub_profile: counts.hub_matched,
    personal_email: counts.personal,
    generic_email: counts.generic,
  });
  console.log('Archetypes:', archetypes);
  console.log('Networks:', franchises);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
