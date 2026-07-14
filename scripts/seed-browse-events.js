#!/usr/bin/env node
/**
 * Seed 300 published browse events with canonical event_type values and Unsplash photos.
 * Idempotent: skips if seed-browse-* rows already exist (use --force to add another batch).
 *
 * Prerequisite: run supabase/migrations/035_event_types_four_categories.sql in Supabase SQL Editor.
 *
 * Usage: node scripts/seed-browse-events.js [--force] [--count=300]
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env') });

const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');
const { MEETING_TYPES } = require('../api/_lib/event-types');
const { slugifyEventTitle } = require('../api/_lib/event-slug');

const SEED_PREFIX = 'seed-browse-';
const DEFAULT_COUNT = 300;
const BATCH_SIZE = 25;

const UNSPLASH = {
  'Networking meeting': [
    'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1515187029135-18ee286d815b?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?q=80&w=1200&auto=format&fit=crop',
  ],
  Netwalking: [
    'https://images.unsplash.com/photo-1515187029135-18ee286d815b?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1551632811-561732d1e58e?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=1200&auto=format&fit=crop',
  ],
  'Sport & social': [
    'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1593113598332-cd288d649433?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1626248801379-51a074fb6dce?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1599587360305-7e6b3ed3d169?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1622279452926-62d24519e2ee?q=80&w=1200&auto=format&fit=crop',
  ],
  Conference: [
    'https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1505373877841-8d25f2941f01?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1591115765373-5207764f72e7?q=80&w=1200&auto=format&fit=crop',
  ],
  Exhibition: [
    'https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1560179707-f14e90ef3623?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1595846519845-68e298c2edd8?q=80&w=1200&auto=format&fit=crop',
  ],
  'Awards ceremony': [
    'https://images.unsplash.com/photo-1560179707-f14e90ef3623?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=1200&auto=format&fit=crop',
  ],
  "Women's networking": [
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1551836022-d5d88e9218df?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1600880292089-90a7e086ee0c?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1556761175-b413da4baf72?q=80&w=1200&auto=format&fit=crop',
  ],
};

const CITIES = [
  { city: 'Manchester', postcode: 'M1 4BT', venue: 'Albert Square Conference Centre' },
  { city: 'London', postcode: 'EC2A 4NE', venue: 'Shoreditch Works' },
  { city: 'Birmingham', postcode: 'B1 2EA', venue: 'Colmore Business District' },
  { city: 'Leeds', postcode: 'LS1 4DY', venue: 'Leeds Dock Hub' },
  { city: 'Bristol', postcode: 'BS1 6QH', venue: 'Harbourside Meeting Rooms' },
  { city: 'Edinburgh', postcode: 'EH1 1RE', venue: 'George Street Exchange' },
  { city: 'Glasgow', postcode: 'G2 3JD', venue: 'Buchanan Street Studios' },
  { city: 'Liverpool', postcode: 'L1 8JQ', venue: 'Baltic Triangle Workspace' },
  { city: 'Newcastle', postcode: 'NE1 7RU', venue: 'Quayside Networking Lounge' },
  { city: 'Sheffield', postcode: 'S1 2BJ', venue: 'Devonshire Quarter Hub' },
  { city: 'Cardiff', postcode: 'CF10 1EP', venue: 'Cardiff Bay Business Club' },
  { city: 'Nottingham', postcode: 'NG1 5FS', venue: 'Lace Market Rooms' },
  { city: 'Leicester', postcode: 'LE1 6TP', venue: 'Highcross Connect' },
  { city: 'Brighton', postcode: 'BN1 1UF', venue: 'North Laine Collective' },
  { city: 'Cambridge', postcode: 'CB2 1TN', venue: 'Innovation Park Lounge' },
];

const TITLE_TEMPLATES = {
  'Networking meeting': [
    '{city} business breakfast',
    '{city} professionals mixer',
    '{city} SME networking lunch',
    'First Friday networking — {city}',
    '{city} founders & freelancers',
  ],
  Netwalking: [
    '{city} city centre netwalk',
    'Morning netwalk — {city}',
    '{city} riverside networking walk',
    'Step & connect netwalk ({city})',
    '{city} park netwalking circle',
  ],
  'Sport & social': [
    '{city} golf networking morning',
    'Padel & connections — {city}',
    '{city} tennis & business social',
    'Run club networking — {city}',
    '{city} sport & social evening',
  ],
  Conference: [
    '{city} growth summit',
    'Future of work conference — {city}',
    '{city} industry leaders forum',
    'Scale-up conference ({city})',
    '{city} business innovation day',
  ],
  Exhibition: [
    '{city} trade & connections expo',
    'Business showcase — {city}',
    '{city} supplier networking fair',
    'Meet the makers exhibition ({city})',
    '{city} B2B exhibition morning',
  ],
  'Awards ceremony': [
    '{city} business awards evening',
    'Excellence in enterprise — {city}',
    '{city} networking awards gala',
    'Celebrating local business ({city})',
    '{city} professional awards night',
  ],
  "Women's networking": [
    'Women in business — {city}',
    '{city} women founders circle',
    "Women's networking breakfast ({city})",
    '{city} professional women\'s lunch',
    'Empower & connect — {city}',
  ],
};

const TYPE_WEIGHTS = {
  Meeting: 120,
  Events: 60,
  Exhibition: 30,
  Awards: 25,
  Webinar: 20,
  Workshop: 20,
  Session: 20,
};

UNSPLASH.Meeting = UNSPLASH['Networking meeting'];
UNSPLASH.Events = UNSPLASH.Conference;
UNSPLASH.Awards = UNSPLASH['Awards ceremony'];

TITLE_TEMPLATES.Meeting = TITLE_TEMPLATES['Networking meeting'];
TITLE_TEMPLATES.Events = TITLE_TEMPLATES.Conference;
TITLE_TEMPLATES.Awards = TITLE_TEMPLATES['Awards ceremony'];

function parseArgs() {
  const force = process.argv.includes('--force');
  const countArg = process.argv.find((a) => a.startsWith('--count='));
  const count = countArg ? Math.max(1, Number(countArg.split('=')[1]) || DEFAULT_COUNT) : DEFAULT_COUNT;
  return { force, count };
}

function buildTypeQueue(total) {
  const weights = MEETING_TYPES.map((t) => ({ type: t, weight: TYPE_WEIGHTS[t] || 20 }));
  const weightSum = weights.reduce((s, w) => s + w.weight, 0);
  const queue = [];
  let assigned = 0;

  weights.forEach((w, idx) => {
    const isLast = idx === weights.length - 1;
    const n = isLast ? total - assigned : Math.round((w.weight / weightSum) * total);
    for (let i = 0; i < n; i++) queue.push(w.type);
    assigned += n;
  });

  while (queue.length < total) queue.push('Meeting');
  while (queue.length > total) queue.pop();
  return queue;
}

function capitalize(s) {
  return String(s || '')
    .split(' ')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

function titleFor(type, city, index) {
  const templates = TITLE_TEMPLATES[type] || TITLE_TEMPLATES.Meeting;
  const template = templates[index % templates.length];
  return capitalize(template.replace(/\{city\}/g, city));
}

function photoFor(type, index) {
  const pool = UNSPLASH[type] || UNSPLASH.Meeting;
  return pool[index % pool.length];
}

function outcodeFromPostcode(postcode) {
  const m = String(postcode || '')
    .trim()
    .toUpperCase()
    .match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)/);
  return m ? m[1] : '';
}

function buildEventRow({ index, eventType, organiserId, existingSlugs }) {
  const loc = CITIES[index % CITIES.length];
  const title = titleFor(eventType, loc.city, index);
  let slug = slugifyEventTitle(title);
  if (existingSlugs.has(slug)) slug = `${slug}-${index + 1}`;
  existingSlugs.add(slug);

  const dayOffset = 7 + (index % 120);
  const startsAt = new Date();
  startsAt.setDate(startsAt.getDate() + dayOffset);
  startsAt.setHours(8 + (index % 10), index % 2 === 0 ? 30 : 0, 0, 0);
  const endsAt = new Date(startsAt);
  endsAt.setHours(startsAt.getHours() + 2 + (index % 3));

  const online = index % 11 === 0;
  const meetingType = online ? 'Online' : 'In person';

  return {
    title,
    slug,
    description: `Browse seed listing for ${eventType.toLowerCase()} in ${loc.city}. Meet local professionals and grow your network.`,
    image_url: photoFor(eventType, index),
    event_type: eventType,
    industries: ['Business'],
    meeting_type: meetingType,
    venue: online ? null : loc.venue,
    city: online ? null : loc.city,
    location_label: online ? 'Online' : loc.city,
    postcode: online ? null : loc.postcode,
    outcode: online ? null : outcodeFromPostcode(loc.postcode),
    meeting_link: online ? 'https://meet.example.com/networker-hub' : null,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    approval_status: 'Approved',
    status: 'published',
    ticket_sales_enabled: true,
    featured: index % 17 === 0,
    organiser_id: organiserId,
    airtable_id: `${SEED_PREFIX}${String(index + 1).padStart(4, '0')}`,
  };
}

async function ensureOrganisers(sb) {
  const names = [
    'Northern Connect',
    'Capital Networkers',
    'Midlands Business Club',
    'Yorkshire Professionals',
    'South West Networking',
    'Scotland Business Hub',
    'Women Who Network',
    'Sport & Social Club',
    'Events Collective UK',
    'The Networker Hub',
  ];

  const ids = [];
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const { data: existing } = await sb.from('organisers').select('id').eq('name', name).maybeSingle();
    if (existing && existing.id) {
      ids.push(existing.id);
      continue;
    }
    const { data: created, error } = await sb
      .from('organisers')
      .insert({
        name,
        email: `seed+${slugifyEventTitle(name)}@networkerhub.example`,
        description: `${name} — sample organiser for browse listings.`,
        organiser_type: 'Events',
        industries: ['Business'],
        meeting_formats: ['In person', 'Online'],
        verification_status: 'Verified',
        listing_status: 'published',
        featured: i < 3,
      })
      .select('id')
      .single();
    if (error) throw new Error(`Organiser "${name}": ${error.message}`);
    ids.push(created.id);
  }
  return ids;
}

async function main() {
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in local.env');
    process.exit(1);
  }

  const { force, count } = parseArgs();
  const sb = getSupabaseAdmin();

  const { count: existingCount, error: countErr } = await sb
    .from('events')
    .select('id', { count: 'exact', head: true })
    .like('airtable_id', `${SEED_PREFIX}%`);

  if (countErr) throw new Error(countErr.message);
  if (existingCount && !force) {
    console.log(`Already seeded ${existingCount} browse events (${SEED_PREFIX}*). Use --force to add more.`);
    return;
  }

  const startIndex = force && existingCount ? existingCount : 0;
  const organiserIds = await ensureOrganisers(sb);

  const { data: slugRows } = await sb.from('events').select('slug').not('slug', 'is', null);
  const existingSlugs = new Set((slugRows || []).map((r) => r.slug).filter(Boolean));

  const typeQueue = buildTypeQueue(count);
  const rows = typeQueue.map((eventType, i) => {
    const index = startIndex + i;
    return buildEventRow({
      index,
      eventType,
      organiserId: organiserIds[index % organiserIds.length],
      existingSlugs,
    });
  });

  let inserted = 0;
  const typeCounts = {};

  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE);
    const { data: created, error } = await sb.from('events').insert(batch).select('id, event_type');
    if (error) {
      throw new Error(
        `Batch insert failed at offset ${offset}: ${error.message}\n` +
          'Run supabase/migrations/030_event_type_sport_womens.sql in Supabase if Sport & social / Women\'s networking are rejected.'
      );
    }

    const tickets = (created || []).map((ev) => ({
      event_id: ev.id,
      name: 'General admission',
      description: 'Free entry',
      price: 0,
      quantity: 80,
      status: 'Active',
    }));
    const { error: tixErr } = await sb.from('tickets').insert(tickets);
    if (tixErr) throw new Error(`Tickets batch failed: ${tixErr.message}`);

    (created || []).forEach((ev) => {
      typeCounts[ev.event_type] = (typeCounts[ev.event_type] || 0) + 1;
    });
    inserted += created.length;
    process.stdout.write(`\rInserted ${inserted}/${count} events…`);
  }

  console.log(`\nDone. Inserted ${inserted} browse events with photos.`);
  console.log('By type:', typeCounts);
  console.log('Refresh /events/ — Sport & social and Women\'s networking filters should now show counts.');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
