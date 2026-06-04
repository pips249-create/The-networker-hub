#!/usr/bin/env node
/**
 * One-time Airtable → Supabase data migration.
 *
 * Prerequisites:
 *   1. Run supabase/migrations/001_initial_schema.sql and 002_hub_platform.sql in SQL Editor
 *   2. Copy .env.example → .env and fill keys
 *
 * Usage:
 *   npm install
 *   node migrate.js
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const AIRTABLE_API_KEY = clean(process.env.AIRTABLE_API_KEY);
const AIRTABLE_BASE_ID = clean(process.env.AIRTABLE_BASE_ID);
const ADMIN_EMAIL = clean(process.env.ADMIN_EMAIL) || 'pips249@gmail.com';
const ADMIN_INITIAL_PASSWORD = clean(process.env.ADMIN_INITIAL_PASSWORD);

const TABLES = {
  organisers: process.env.AIRTABLE_ORGANISERS_TABLE || 'Organisers',
  events: process.env.AIRTABLE_EVENTS_TABLE || 'Events',
  tickets: process.env.AIRTABLE_TICKETS_TABLE || 'Tickets',
  users: process.env.AIRTABLE_USERS_TABLE || 'Users',
};

function clean(v) {
  if (v == null) return '';
  return String(v).trim().replace(/^['"]|['"]$/g, '');
}

function pick(fields, keys) {
  for (const k of keys) {
    if (fields[k] !== undefined && fields[k] !== null && fields[k] !== '') return fields[k];
  }
  return null;
}

function attachmentUrl(raw) {
  if (!raw) return null;
  if (typeof raw === 'string' && raw.startsWith('http')) return raw;
  if (Array.isArray(raw) && raw[0]?.url) return raw[0].url;
  if (raw?.url) return raw.url;
  return null;
}

function linkedIds(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
  return [String(raw)];
}

function firstLink(raw) {
  const ids = linkedIds(raw);
  return ids[0] || null;
}

function parseMoney(raw) {
  if (raw == null || raw === '') return 0;
  const n = Number(String(raw).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function parseIsoDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function mapEventType(raw) {
  const s = String(raw || '').toLowerCase();
  if (s.includes('exhibit')) return 'Exhibition';
  if (s.includes('conference')) return 'Conference';
  return 'Networking / Meeting';
}

function mapMeetingType(raw) {
  const s = String(raw || '').toLowerCase();
  if (s.includes('online') && !s.includes('person')) return 'Online';
  if (s.includes('hybrid')) return 'Hybrid';
  if (s.includes('person') || s.includes('in-person') || s.includes('in person')) return 'In person';
  return null;
}

function mapApprovalStatus(raw) {
  const s = String(raw || '').toLowerCase();
  if (s.includes('approv') && !s.includes('pending')) return 'Approved';
  if (s.includes('reject') || s.includes('denied')) return 'Rejected';
  return 'Pending Review';
}

function mapListingStatus(raw) {
  const s = String(raw || '').toLowerCase();
  if (s.includes('publish') || s.includes('live') || s.includes('approved')) return 'published';
  if (s.includes('unpublish') || s.includes('hidden')) return 'unpublished';
  return 'draft';
}

function mapTicketStatus(raw, soldOut) {
  if (soldOut) return 'Sold out';
  const s = String(raw || '').toLowerCase();
  if (s.includes('pause')) return 'Paused';
  if (s.includes('sold')) return 'Sold out';
  return 'Active';
}

async function fetchAirtableTable(tableName, view) {
  const baseUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`;
  const all = [];
  let offset;
  do {
    const q = new URLSearchParams({ pageSize: '100' });
    if (view) q.set('view', view);
    if (offset) q.set('offset', offset);
    const resp = await fetch(`${baseUrl}?${q}`, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Airtable ${tableName}: ${resp.status} ${err}`);
    }
    const data = await resp.json();
    all.push(...(data.records || []));
    offset = data.offset;
  } while (offset);
  return all;
}

async function upsertBatch(sb, table, rows, label) {
  if (!rows.length) {
    console.log(`  ${label}: 0 rows`);
    return [];
  }
  const chunkSize = 50;
  const out = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { data, error } = await sb.from(table).upsert(chunk, { onConflict: 'airtable_id' }).select();
    if (error) throw new Error(`${table} upsert: ${error.message}`);
    out.push(...(data || []));
    console.log(`  ${label}: ${Math.min(i + chunkSize, rows.length)} / ${rows.length}`);
  }
  return out;
}

function mapOrganiser(record) {
  const f = record.fields || {};
  const statusRaw = pick(f, [
    'Status',
    'Profile Status',
    'Listing Status',
    'Publish Status',
    'Published',
  ]);
  return {
    airtable_id: record.id,
    name: String(pick(f, ['Organiser Name', 'Group Name', 'Name', 'Title']) || 'Untitled organiser').trim(),
    email: pick(f, ['Email', 'Owner Email', 'Organiser Email'])?.toString().toLowerCase() || null,
    website: pick(f, ['Website', 'Website URL', 'URL']) || null,
    description: pick(f, ['Description', 'About', 'Profile', 'Company Profile']) || null,
    photo_url: attachmentUrl(pick(f, ['Logo', 'Photo', 'Image', 'Cover'])),
    listing_status: mapListingStatus(statusRaw),
    verification_status: /verified|live|publish/i.test(String(statusRaw || '')) ? 'Verified' : 'Pending',
    featured: Boolean(pick(f, ['Featured', 'Premium'])),
  };
}

function mapEvent(record, organiserUuidByAirtable) {
  const f = record.fields || {};
  const orgLink =
    firstLink(
      pick(f, [
        'Organisers',
        'Organiser',
        'Organiser Group',
        'Host',
        'Host/Organiser',
      ])
    ) || null;
  const typeRaw = pick(f, ['Meeting Type', 'Type', 'Event Type', 'Format']);
  const formatRaw = pick(f, ['Meeting Format', 'Format', 'Event Format']);
  const highlights = pick(f, ['Highlights', 'Description', 'About']);
  const highlightsArr = highlights
    ? String(highlights)
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return {
    airtable_id: record.id,
    title: String(pick(f, ['Event Title', 'Title', 'Name']) || 'Untitled event').trim(),
    description: pick(f, ['Description', 'About', 'Summary']) || highlightsArr.join('\n') || null,
    photo_url: attachmentUrl(pick(f, ['Photo', 'Image', 'Cover', 'Photos'])),
    event_type: mapEventType(typeRaw),
    industries: pick(f, ['Industry', 'Industries'])
      ? [String(pick(f, ['Industry', 'Industries']))]
      : null,
    highlights: highlightsArr.length ? highlightsArr : null,
    starts_at: parseIsoDate(pick(f, ['Date & Time', 'Date', 'Event Date', 'Start Date'])),
    ends_at: parseIsoDate(pick(f, ['End Date', 'End Time', 'Finish Time'])),
    meeting_type: mapMeetingType(formatRaw || typeRaw),
    venue: pick(f, ['Venue', 'Venue Name']) || null,
    address: pick(f, ['Address', 'Address Line 1', 'Street Address']) || null,
    postcode: pick(f, ['Postcode', 'Postal Code']) || null,
    city: pick(f, ['City', 'Town']) || null,
    location_label: pick(f, ['Location', 'City', 'Region']) || null,
    meeting_link: pick(f, ['Join Link', 'Meeting Link', 'Online Link', 'Zoom Link']) || null,
    latitude: pick(f, ['Latitude', 'Lat']) != null ? Number(pick(f, ['Latitude', 'Lat'])) : null,
    longitude: pick(f, ['Longitude', 'Lng']) != null ? Number(pick(f, ['Longitude', 'Lng'])) : null,
    approval_status: mapApprovalStatus(pick(f, ['Approval Status', 'Status', 'Listing Status'])),
    featured: Boolean(pick(f, ['Featured', 'Premium'])),
    organiser_id: orgLink ? organiserUuidByAirtable[orgLink] || null : null,
  };
}

function mapTicket(record, eventUuidByAirtable) {
  const f = record.fields || {};
  const eventLink = firstLink(pick(f, ['Linked Event', 'Event', 'Events']));
  const soldOut = /sold/i.test(String(pick(f, ['Sold Out', 'Status', 'Ticket Status']) || ''));
  return {
    airtable_id: record.id,
    name: String(pick(f, ['Ticket Name', 'Ticket Type', 'Name']) || 'Ticket').trim(),
    description: pick(f, ['Ticket Description', 'Description']) || null,
    price: parseMoney(pick(f, ['Price', 'Ticket Price', 'Amount'])),
    quantity:
      pick(f, ['Quantity Available', 'Quantity']) != null
        ? Math.max(0, Number(pick(f, ['Quantity Available', 'Quantity'])))
        : null,
    status: mapTicketStatus(pick(f, ['Status', 'Ticket Status']), soldOut),
    event_id: eventLink ? eventUuidByAirtable[eventLink] || null : null,
  };
}

async function migrateAuthUsers(sb, airtableUsers) {
  console.log('\n── Auth users (Supabase Auth + hub_accounts) ──');
  let created = 0;
  let skipped = 0;

  for (const record of airtableUsers) {
    const f = record.fields || {};
    const email = String(pick(f, ['Email', 'email']) || '')
      .trim()
      .toLowerCase();
    if (!email) {
      skipped++;
      continue;
    }
    const roleRaw = pick(f, ['Role', 'role']);
    const role = String(roleRaw || 'client').toLowerCase() === 'admin' ? 'admin' : 'client';
    const name = pick(f, ['Name', 'Full Name', 'name']) || null;

    let password = null;
    if (email === ADMIN_EMAIL.toLowerCase() && ADMIN_INITIAL_PASSWORD) {
      password = ADMIN_INITIAL_PASSWORD;
    }

    if (!password) {
      console.log(`  skip auth (no password): ${email} — reset password after migration`);
      skipped++;
      continue;
    }

    const { data: existing } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const found = existing?.users?.find((u) => u.email?.toLowerCase() === email);

    let userId = found?.id;
    if (!userId) {
      const { data, error } = await sb.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, airtable_id: record.id },
      });
      if (error) {
        console.warn(`  warn ${email}: ${error.message}`);
        skipped++;
        continue;
      }
      userId = data.user.id;
      created++;
      console.log(`  created auth user: ${email} (${role})`);
    } else {
      console.log(`  exists: ${email}`);
    }

    await sb.from('hub_accounts').upsert(
      {
        user_id: userId,
        role,
        hub_view: 'organiser',
        display_name: name,
      },
      { onConflict: 'user_id' }
    );

    if (role === 'admin') continue;

    await sb.from('attendees').upsert(
      {
        airtable_id: record.id,
        email,
        name,
        supabase_user_id: userId,
      },
      { onConflict: 'airtable_id' }
    );
  }

  console.log(`  auth: ${created} created, ${skipped} skipped`);
}

async function main() {
  console.log('The Networker Hub — Airtable → Supabase migration\n');

  const missing = [];
  if (!SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!AIRTABLE_API_KEY) missing.push('AIRTABLE_API_KEY');
  if (!AIRTABLE_BASE_ID) missing.push('AIRTABLE_BASE_ID');
  if (missing.length) {
    console.error('Missing in .env:', missing.join(', '));
    process.exit(1);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: pingErr } = await sb.from('events').select('id').limit(1);
  if (pingErr) {
    console.error('Supabase connection failed:', pingErr.message);
    console.error('Run 001_initial_schema.sql and 002_hub_platform.sql first.');
    process.exit(1);
  }

  console.log('Fetching Airtable…');
  const [orgRecords, eventRecords, ticketRecords, userRecords] = await Promise.all([
    fetchAirtableTable(TABLES.organisers),
    fetchAirtableTable(TABLES.events, process.env.AIRTABLE_EVENTS_VIEW),
    fetchAirtableTable(TABLES.tickets),
    fetchAirtableTable(TABLES.users),
  ]);
  console.log(
    `  organisers: ${orgRecords.length}, events: ${eventRecords.length}, tickets: ${ticketRecords.length}, users: ${userRecords.length}`
  );

  console.log('\n── Organisers ──');
  const organiserRows = orgRecords.map(mapOrganiser);
  const organiserSaved = await upsertBatch(sb, 'organisers', organiserRows, 'organisers');
  const organiserUuidByAirtable = {};
  for (const row of organiserSaved) {
    if (row.airtable_id) organiserUuidByAirtable[row.airtable_id] = row.id;
  }

  console.log('\n── Events ──');
  const eventRows = eventRecords.map((r) => mapEvent(r, organiserUuidByAirtable));
  const eventSaved = await upsertBatch(sb, 'events', eventRows, 'events');
  const eventUuidByAirtable = {};
  for (const row of eventSaved) {
    if (row.airtable_id) eventUuidByAirtable[row.airtable_id] = row.id;
  }

  console.log('\n── Tickets ──');
  const ticketRows = ticketRecords
    .map((r) => mapTicket(r, eventUuidByAirtable))
    .filter((t) => t.event_id);
  await upsertBatch(sb, 'tickets', ticketRows, 'tickets');

  await migrateAuthUsers(sb, userRecords);

  console.log('\nDone.');
  console.log('Set DATA_PROVIDER=supabase in Vercel, redeploy, then check /api/events');
  if (!ADMIN_INITIAL_PASSWORD) {
    console.log('Tip: set ADMIN_INITIAL_PASSWORD in .env to migrate admin login to Supabase Auth.');
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
