#!/usr/bin/env node
/**
 * THE NETWORKER HUB — Phase 2 Migration (Airtable → Supabase)
 *
 * Order: auth users → organisers → attendees → events → tickets → registrations → reviews
 *
 * Run: npm install && node migrate.js
 * Requires .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AIRTABLE_API_KEY
 * Optional: AIRTABLE_BASE_ID (default appQwgOxCrFFNweHe), ADMIN_INITIAL_PASSWORD
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const AIRTABLE_TOKEN = clean(process.env.AIRTABLE_API_KEY);
const AIRTABLE_BASE = clean(process.env.AIRTABLE_BASE_ID) || 'appQwgOxCrFFNweHe';
const TEMP_PASSWORD = clean(process.env.ADMIN_INITIAL_PASSWORD) || 'Networker2025!';
const ADMIN_EMAIL = (clean(process.env.ADMIN_EMAIL) || 'pips249@gmail.com').toLowerCase();

const TBL_ORGANISERS = 'tblmiVfIo1xseppQP';
const TBL_EVENTS = 'tblOwGcn7BKt71j6b';
const TBL_TICKETS = 'tblNwU9Ab8rBE6c0x';
const TBL_ATTENDEES = 'tblZ7nqMUeIVIWqoT';
const TBL_REGISTRATIONS = 'tblK9bR1Za6681JET';
const TBL_REVIEWS = 'tbl2JsiBTFHC0zHGU';
const TBL_USERS = process.env.AIRTABLE_USERS_TABLE_ID || null;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const idMap = {
  organisers: new Map(),
  attendees: new Map(),
  events: new Map(),
  tickets: new Map(),
  reviews: new Map(),
  registrations: new Map(),
  usersByEmail: new Map(),
};

const stats = {
  users: { created: 0, existed: 0, failed: 0, hubAccounts: 0 },
  organisers: { inserted: 0, failed: 0 },
  attendees: { inserted: 0, failed: 0 },
  events: { inserted: 0, failed: 0 },
  tickets: { inserted: 0, failed: 0 },
  registrations: { inserted: 0, failed: 0 },
  reviews: { inserted: 0, failed: 0 },
};

/** tableId → { fieldId: fieldName } */
const fieldMeta = new Map();

function clean(v) {
  if (v == null) return '';
  return String(v).trim().replace(/^['"]|['"]$/g, '');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function parseArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.map((v) => (typeof v === 'object' && v?.name ? v.name : v)).filter(Boolean);
  return [];
}

function parseSelect(val) {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val.name) return val.name;
  return null;
}

function parseDate(val) {
  if (!val) return null;
  try {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

function firstLinkId(raw) {
  if (!raw) return null;
  const arr = Array.isArray(raw) ? raw : [raw];
  const first = arr[0];
  if (typeof first === 'string') return first;
  if (first && first.id) return first.id;
  return null;
}

function f(record, fieldId) {
  const names = fieldMeta.get(record._tableId);
  const name = names?.get(fieldId);
  if (!name) return record.fields?.[fieldId] ?? null;
  return record.fields?.[name] ?? null;
}

async function loadFieldMeta() {
  const resp = await fetch(`https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE}/tables`, {
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
  });
  if (!resp.ok) {
    throw new Error(`Airtable meta API ${resp.status}: ${await resp.text()}`);
  }
  const data = await resp.json();
  for (const table of data.tables || []) {
    const map = new Map();
    for (const field of table.fields || []) {
      map.set(field.id, field.name);
    }
    fieldMeta.set(table.id, map);
  }
}

async function fetchAll(tableId) {
  const records = [];
  let offset = null;
  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${tableId}`);
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    });
    if (!res.ok) throw new Error(`Airtable ${tableId} ${res.status}: ${await res.text()}`);
    const data = await res.json();
    for (const rec of data.records || []) {
      rec._tableId = tableId;
      records.push(rec);
    }
    offset = data.offset || null;
    if (offset) await sleep(200);
  } while (offset);
  return records;
}

async function createAuthUser(email, name, metaRole) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: name, role: metaRole, imported: true },
  });

  if (error) {
    if (/already|exists/i.test(error.message || '')) {
      const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const match = list?.users?.find((u) => u.email?.toLowerCase() === email);
      if (match) return { id: match.id, existed: true };
    }
    return { error: error.message };
  }
  return { id: data.user.id, existed: false };
}

async function upsertHubAccount(userId, email, name, metaRole) {
  const isAdmin = email === ADMIN_EMAIL;
  const hubView = metaRole === 'organiser' || metaRole === 'both' ? 'organiser' : 'attendee';
  const { error } = await supabase.from('hub_accounts').upsert(
    {
      user_id: userId,
      role: isAdmin ? 'admin' : 'client',
      hub_view: isAdmin ? 'organiser' : hubView,
      display_name: name || null,
    },
    { onConflict: 'user_id' }
  );
  if (!error) stats.users.hubAccounts++;
}

async function migrateUsers(organisers, attendees, airtableUsers) {
  console.log('\n── Step 1: Supabase auth users + hub_accounts ──');

  const adminRoles = new Map();
  for (const r of airtableUsers || []) {
    const email = String(
      r.fields?.Email || r.fields?.email || pickField(r, ['Email', 'email']) || ''
    )
      .trim()
      .toLowerCase();
    const role = String(r.fields?.Role || r.fields?.role || '').toLowerCase();
    if (email && role === 'admin') adminRoles.set(email, true);
  }

  const emailMap = new Map();

  for (const r of organisers) {
    const email = String(f(r, 'fldAlXFkC88eXanPJ') || '')
      .trim()
      .toLowerCase();
    const name = f(r, 'fldZQxiA56hZXGxkY') || '';
    if (email && !emailMap.has(email)) {
      emailMap.set(email, { name, role: 'organiser', airtableId: r.id });
    }
  }

  for (const r of attendees) {
    const email = String(f(r, 'fldqyMOMtvMwKuZTu') || '')
      .trim()
      .toLowerCase();
    const name = f(r, 'fldri0VDgXwn37w5n') || '';
    if (!email) continue;
    if (!emailMap.has(email)) {
      emailMap.set(email, { name, role: 'attendee', airtableId: r.id });
    } else {
      emailMap.get(email).role = 'both';
    }
  }

  const entries = [...emailMap.entries()];
  console.log(`  ${entries.length} unique emails`);

  let i = 0;
  for (const [email, meta] of entries) {
    i++;
    const result = await createAuthUser(email, meta.name, meta.role);
    if (result.error) {
      stats.users.failed++;
      console.warn(`  failed ${email}: ${result.error}`);
    } else {
      idMap.usersByEmail.set(email, result.id);
      if (result.existed) stats.users.existed++;
      else stats.users.created++;
      if (adminRoles.has(email) || email === ADMIN_EMAIL) {
        await upsertHubAccount(result.id, email, meta.name, 'organiser');
      } else {
        await upsertHubAccount(result.id, email, meta.name, meta.role);
      }
    }
    if (i % 50 === 0 || i === entries.length) {
      console.log(
        `  [${Math.round((i / entries.length) * 100)}%] ${i}/${entries.length} created:${stats.users.created} existed:${stats.users.existed} failed:${stats.users.failed}`
      );
    }
    await sleep(120);
  }
}

function pickField(record, names) {
  for (const n of names) {
    if (record.fields?.[n] != null && record.fields[n] !== '') return record.fields[n];
  }
  return null;
}

function mapListingStatus(verification) {
  const s = String(verification || '').toLowerCase();
  if (s.includes('verified') || s.includes('approv')) return 'published';
  return 'draft';
}

async function migrateOrganisers(records) {
  console.log(`\n── Step 2: ${records.length} organisers ──`);
  for (const batch of chunk(records, 50)) {
    const rows = batch.map((r) => {
      const email = f(r, 'fldAlXFkC88eXanPJ');
      const verification = parseSelect(f(r, 'fldPn73dsvB7JfiFN'));
      return {
        name: f(r, 'fldZQxiA56hZXGxkY') || 'Unnamed Organiser',
        email: email || null,
        phone: f(r, 'fldLS1QG2Oq2Ql44y') || null,
        website: f(r, 'fld6WJ0JPsn4waxiN') || null,
        description: f(r, 'fld7XK3AMhBKbdOag') || null,
        organiser_type: parseSelect(f(r, 'fldoQVap0beGCI4BF')),
        industries: parseArray(f(r, 'fldXoGgwHuoucGG47')),
        meeting_formats: parseArray(f(r, 'fldp3IsU83xzwZk58')),
        verification_status: verification || 'Pending',
        listing_status: mapListingStatus(verification),
        featured: Boolean(f(r, 'fldyXZQNWhvt2SeRR')),
        stripe_account_id: f(r, 'flddTJypexFZVNfeG') || null,
        payout_email: f(r, 'fldh2lxmrHoZaJDzn') || null,
        supabase_user_id: email ? idMap.usersByEmail.get(String(email).toLowerCase()) || null : null,
        airtable_id: r.id,
      };
    });

    const { data, error } = await supabase
      .from('organisers')
      .upsert(rows, { onConflict: 'airtable_id' })
      .select('id, airtable_id');

    if (error) {
      console.error('  batch error:', error.message);
      stats.organisers.failed += batch.length;
    } else {
      (data || []).forEach((row) => idMap.organisers.set(row.airtable_id, row.id));
      stats.organisers.inserted += (data || []).length;
    }
    await sleep(100);
  }
  console.log(`  done: ${stats.organisers.inserted} organisers`);
}

async function migrateAttendees(records) {
  console.log(`\n── Step 3: ${records.length} attendees ──`);
  for (const batch of chunk(records, 50)) {
    const rows = batch.map((r) => {
      const email = f(r, 'fldqyMOMtvMwKuZTu');
      return {
        name: f(r, 'fldri0VDgXwn37w5n') || null,
        email: email || null,
        company: f(r, 'fldrGXjAS1G7mswqM') || null,
        location: f(r, 'fldInuRRPmJcvF3Wp') || null,
        interests: parseArray(f(r, 'fldfDRfsubEjGXh65')),
        marketing_opt_in: Boolean(f(r, 'fldQGTFCNVKYy1dYO')),
        supabase_user_id: email ? idMap.usersByEmail.get(String(email).toLowerCase()) || null : null,
        airtable_id: r.id,
      };
    });

    const { data, error } = await supabase
      .from('attendees')
      .upsert(rows, { onConflict: 'airtable_id' })
      .select('id, airtable_id');

    if (error) {
      console.error('  batch error:', error.message);
      stats.attendees.failed += batch.length;
    } else {
      (data || []).forEach((row) => idMap.attendees.set(row.airtable_id, row.id));
      stats.attendees.inserted += (data || []).length;
    }
    await sleep(100);
  }
  console.log(`  done: ${stats.attendees.inserted} attendees`);
}

async function migrateEvents(records) {
  console.log(`\n── Step 4: ${records.length} events ──`);
  const eventTypeMap = {
    'Networking Event': 'Networking / Meeting',
    'Networking / Meeting': 'Networking / Meeting',
    Exhibition: 'Exhibition',
    Conference: 'Conference',
  };

  for (const batch of chunk(records, 50)) {
    const rows = batch.map((r) => {
      const orgAirtableId = firstLinkId(f(r, 'fldcYbHdq4W8ZqnCT'));
      const parts = [
        f(r, 'fldbYJ0fH8fXiYILG'),
        f(r, 'fldSQ0GLPnzOwPfOb'),
        f(r, 'fldw8ZvcyY87tx6ju'),
        f(r, 'fldtOM5Qx9OuPEXzX'),
      ].filter(Boolean);
      const rawType = parseSelect(f(r, 'fld03lzgcIb5vLHzN'));

      return {
        title: f(r, 'fldXc2awyMUKGr3sJ') || 'Untitled Event',
        description: f(r, 'fldkKjRkIJRitSigJ') || null,
        event_type: eventTypeMap[rawType] || 'Networking / Meeting',
        industries: parseArray(f(r, 'fldKxTzXpZz6S1g9V')),
        highlights: parseArray(f(r, 'fldTCRWZRu0xEhp4j')),
        starts_at: parseDate(f(r, 'fld38F9hklPYifPX7')),
        ends_at: parseDate(f(r, 'fldH5eUvCTXPcp1vg')),
        meeting_type: parseSelect(f(r, 'fldbiGglQL9cYbvYY')),
        venue: f(r, 'fldbYJ0fH8fXiYILG') || null,
        address: f(r, 'fldSQ0GLPnzOwPfOb') || null,
        postcode: f(r, 'fldw8ZvcyY87tx6ju') || null,
        city: f(r, 'fldtOM5Qx9OuPEXzX') || null,
        location_label: parts.length ? parts.join(', ') : f(r, 'fldQQ5jtbuQD4Lxc0') || null,
        meeting_link: f(r, 'fldLU4yI0C6Csx2Zr') || null,
        latitude: f(r, 'fld7O45keJbSm9Sd3') != null ? Number(f(r, 'fld7O45keJbSm9Sd3')) : null,
        longitude: f(r, 'fldqzMK75oraJkxiS') != null ? Number(f(r, 'fldqzMK75oraJkxiS')) : null,
        approval_status: parseSelect(f(r, 'fldKXURWRuPhCr3DD')) || 'Pending Review',
        featured: Boolean(f(r, 'fldwXeSzvRg6puoIr')),
        stripe_payment_link: f(r, 'fldzZEljccI0BjNPf') || null,
        recurrence_pattern: parseSelect(f(r, 'fld8rR2GAQRxBTlzx')),
        recurrence_end_date: f(r, 'fldmkAANbvrwIT5E8') || null,
        organiser_id: orgAirtableId ? idMap.organisers.get(orgAirtableId) || null : null,
        airtable_id: r.id,
      };
    });

    const { data, error } = await supabase
      .from('events')
      .upsert(rows, { onConflict: 'airtable_id' })
      .select('id, airtable_id');

    if (error) {
      console.error('  batch error:', error.message);
      stats.events.failed += batch.length;
    } else {
      (data || []).forEach((row) => idMap.events.set(row.airtable_id, row.id));
      stats.events.inserted += (data || []).length;
    }
    await sleep(100);
  }
  console.log(`  done: ${stats.events.inserted} events`);
}

async function migrateTickets(records) {
  console.log(`\n── Step 5: ${records.length} tickets ──`);
  for (const batch of chunk(records, 50)) {
    const rows = batch
      .map((r) => {
        const eventAirtableId = firstLinkId(f(r, 'fldPjuid7olS5ZffC'));
        const event_id = eventAirtableId ? idMap.events.get(eventAirtableId) : null;
        if (!event_id) return null;
        return {
          name: f(r, 'fldGZu2IBaAMC7ZAH') || 'General Admission',
          description: f(r, 'fld7h91fMaZbMgRZ9') || null,
          price: Number(f(r, 'fldGtRfdGtjs2dQ2W')) || 0,
          quantity: f(r, 'fldyxYp2RoZcrastZ') != null ? Number(f(r, 'fldyxYp2RoZcrastZ')) : null,
          ticket_type: parseSelect(f(r, 'fldmvDlz2xOBcXBnj')) || 'Standard',
          sale_starts_at: parseDate(f(r, 'fldzgVB1CKk5xOmgs')),
          sale_ends_at: parseDate(f(r, 'fldMHrXUpLMO4LCgz')),
          status: parseSelect(f(r, 'fldaLQWmnxpZ3nxMN')) || 'Active',
          event_id,
          airtable_id: r.id,
        };
      })
      .filter(Boolean);

    if (!rows.length) continue;

    const { data, error } = await supabase
      .from('tickets')
      .upsert(rows, { onConflict: 'airtable_id' })
      .select('id, airtable_id');

    if (error) {
      console.error('  batch error:', error.message);
      stats.tickets.failed += batch.length;
    } else {
      (data || []).forEach((row) => idMap.tickets.set(row.airtable_id, row.id));
      stats.tickets.inserted += (data || []).length;
    }
    await sleep(100);
  }
  console.log(`  done: ${stats.tickets.inserted} tickets`);
}

async function migrateRegistrations(records) {
  console.log(`\n── Step 6: ${records.length} registrations ──`);
  for (const batch of chunk(records, 50)) {
    const rows = batch.map((r) => ({
      attendee_id: firstLinkId(f(r, 'fld78IzYuUTrAlZLB'))
        ? idMap.attendees.get(firstLinkId(f(r, 'fld78IzYuUTrAlZLB'))) || null
        : null,
      event_id: firstLinkId(f(r, 'fldccyM7dnaH6R6xW'))
        ? idMap.events.get(firstLinkId(f(r, 'fldccyM7dnaH6R6xW'))) || null
        : null,
      organiser_id: firstLinkId(f(r, 'fldnKs1OXBjWAT8Ij'))
        ? idMap.organisers.get(firstLinkId(f(r, 'fldnKs1OXBjWAT8Ij'))) || null
        : null,
      payment_status: parseSelect(f(r, 'fldTOL2MpECrcEtQh')) || 'Pending',
      amount_paid: Number(f(r, 'fldmy1X7VRrha7LUd')) || 0,
      stripe_payment_intent_id: f(r, 'fldhZ1ozl2oUhmKU7') || null,
      application_status: parseSelect(f(r, 'fldMjwpeSfARUMATx')) || 'Approved',
      screening_answer_industry: f(r, 'fld6m2Oh8CAalWb8I') || null,
      screening_answer_job_title: f(r, 'fldMmFvy4a9xRF2Mi') || null,
      ticket_email_sent: Boolean(f(r, 'fldIa8kFdbB7FeRCK')),
      ticket_pdf_sent: Boolean(f(r, 'fldUfhGbWO0WYt48q')),
      meeting_link: f(r, 'fldXIL9htwAoVD69n') || null,
      airtable_id: r.id,
    }));

    const { data, error } = await supabase
      .from('registrations')
      .upsert(rows, { onConflict: 'airtable_id' })
      .select('id, airtable_id');

    if (error) {
      console.error('  batch error:', error.message);
      stats.registrations.failed += batch.length;
    } else {
      stats.registrations.inserted += (data || []).length;
    }
    await sleep(100);
  }
  console.log(`  done: ${stats.registrations.inserted} registrations`);
}

async function migrateReviews(records) {
  console.log(`\n── Step 7: ${records.length} reviews ──`);
  for (const batch of chunk(records, 50)) {
    const rows = batch.map((r) => ({
      attendee_id: firstLinkId(f(r, 'fldXtxJxjOmlT7u7k'))
        ? idMap.attendees.get(firstLinkId(f(r, 'fldXtxJxjOmlT7u7k'))) || null
        : null,
      event_id: firstLinkId(f(r, 'fldGwLIv3CBCAgmw6'))
        ? idMap.events.get(firstLinkId(f(r, 'fldGwLIv3CBCAgmw6'))) || null
        : null,
      organiser_id: firstLinkId(f(r, 'fldssfG732BIL28xq'))
        ? idMap.organisers.get(firstLinkId(f(r, 'fldssfG732BIL28xq'))) || null
        : null,
      rating: f(r, 'fldI7oHpJaGYdMLJU') != null ? Number(f(r, 'fldI7oHpJaGYdMLJU')) : null,
      review_text: f(r, 'fldTp9vOCtn9vjvs4') || null,
      organiser_response: f(r, 'fldBjnx3i4jGNtvQt') || null,
      airtable_id: r.id,
    }));

    const { data, error } = await supabase
      .from('reviews')
      .upsert(rows, { onConflict: 'airtable_id' })
      .select('id, airtable_id');

    if (error) {
      console.error('  batch error:', error.message);
      stats.reviews.failed += batch.length;
    } else {
      stats.reviews.inserted += (data || []).length;
    }
    await sleep(100);
  }
  console.log(`  done: ${stats.reviews.inserted} reviews`);
}

async function fetchUsersTable() {
  const tableName = process.env.AIRTABLE_USERS_TABLE || 'Users';
  for (const [tableId, fields] of fieldMeta.entries()) {
    const names = [...fields.values()];
    if (names.includes('Email') && names.includes('Role')) {
      return fetchAll(tableId);
    }
  }
  try {
    return await fetchAll(tableName);
  } catch {
    return [];
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  THE NETWORKER HUB — Phase 2 Migration');
  console.log('  Airtable → Supabase');
  console.log('═══════════════════════════════════════════════════════\n');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !AIRTABLE_TOKEN) {
    console.error('Missing .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AIRTABLE_API_KEY');
    process.exit(1);
  }

  console.log('Loading Airtable field metadata…');
  await loadFieldMeta();

  const { error: ping } = await supabase.from('events').select('id').limit(1);
  if (ping) {
    console.error('Supabase error:', ping.message);
    console.error('Run 001_initial_schema.sql and 002_hub_platform.sql first.');
    process.exit(1);
  }

  console.log('Fetching Airtable tables…\n');
  const [organisers, events, tickets, attendees, registrations, reviews, users] = await Promise.all([
    fetchAll(TBL_ORGANISERS),
    fetchAll(TBL_EVENTS),
    fetchAll(TBL_TICKETS),
    fetchAll(TBL_ATTENDEES),
    fetchAll(TBL_REGISTRATIONS),
    fetchAll(TBL_REVIEWS),
    fetchUsersTable(),
  ]);

  console.log(`  organisers: ${organisers.length}, events: ${events.length}, tickets: ${tickets.length}`);
  console.log(`  attendees: ${attendees.length}, registrations: ${registrations.length}, reviews: ${reviews.length}`);
  console.log(`  users (role lookup): ${users.length}`);
  console.log(`\n  Temp password for new auth users: (from ADMIN_INITIAL_PASSWORD in .env)`);

  await migrateUsers(organisers, attendees, users);
  await migrateOrganisers(organisers);
  await migrateAttendees(attendees);
  await migrateEvents(events);
  await migrateTickets(tickets);
  await migrateRegistrations(registrations);
  await migrateReviews(reviews);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  MIGRATION COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Auth users   created: ${stats.users.created}  existed: ${stats.users.existed}  failed: ${stats.users.failed}`);
  console.log(`  hub_accounts upserted: ${stats.users.hubAccounts}`);
  console.log(`  Organisers   ${stats.organisers.inserted} (failed ${stats.organisers.failed})`);
  console.log(`  Attendees    ${stats.attendees.inserted} (failed ${stats.attendees.failed})`);
  console.log(`  Events       ${stats.events.inserted} (failed ${stats.events.failed})`);
  console.log(`  Tickets      ${stats.tickets.inserted} (failed ${stats.tickets.failed})`);
  console.log(`  Registrations ${stats.registrations.inserted} (failed ${stats.registrations.failed})`);
  console.log(`  Reviews      ${stats.reviews.inserted} (failed ${stats.reviews.failed})`);
  console.log('\n  Next: set DATA_PROVIDER=supabase in Vercel, redeploy, open /api/events\n');
}

main().catch((err) => {
  console.error('\nMigration failed:', err.message);
  process.exit(1);
});
