#!/usr/bin/env node
/**
 * Remove browse/sample seed data from Supabase.
 *
 * Targets:
 * - Events with airtable_id like seed-browse-* (seed-browse-events.js)
 * - Sample event "Welcome networking evening" / description contains "Sample listing"
 * - Organisers with email seed+*@networkerhub.example (seed-browse-events.js)
 * - Sample organiser profile from seed-sample-event.js
 *
 * Usage:
 *   node scripts/delete-seed-events.js           # dry run
 *   node scripts/delete-seed-events.js --execute
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env.local') });
dotenv.config({ path: path.join(root, '.env') });

const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');

const SEED_PREFIX = 'seed-browse-';
const SAMPLE_EVENT_TITLE = 'Welcome networking evening';
const SAMPLE_ORGANISER_DESCRIPTION = 'Sample organiser profile for testing the events listing.';
const ORGANISER_REF_TABLES = [
  'events',
  'registrations',
  'reviews',
  'workshops',
  'business_opportunities',
  'listing_reports',
];
const CHUNK = 80;

async function unlinkOrganiserRefs(sb, organiserIds) {
  const ids = [...new Set((organiserIds || []).filter(Boolean))];
  if (!ids.length) return;

  for (const id of ids) {
    for (const table of ORGANISER_REF_TABLES) {
      const { error } = await sb.from(table).update({ organiser_id: null }).eq('organiser_id', id);
      if (error) throw new Error(error.message);
    }
  }
}

function parseArgs() {
  return { execute: process.argv.slice(2).includes('--execute') };
}

async function fetchAllRows(sb, table, select, filterFn) {
  const rows = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    let query = sb.from(table).select(select).range(from, from + pageSize - 1);
    if (filterFn) query = filterFn(query);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function fetchSeedBrowseEvents(sb) {
  return fetchAllRows(sb, 'events', 'id, title, airtable_id', (query) =>
    query.like('airtable_id', `${SEED_PREFIX}%`)
  );
}

async function fetchSampleEvents(sb) {
  const [byTitle, byDescription] = await Promise.all([
    fetchAllRows(sb, 'events', 'id, title, description, organiser_id', (query) =>
      query.eq('title', SAMPLE_EVENT_TITLE)
    ),
    fetchAllRows(sb, 'events', 'id, title, description, organiser_id', (query) =>
      query.ilike('description', '%Sample listing%')
    ),
  ]);

  return [...new Map([...byTitle, ...byDescription].map((row) => [row.id, row])).values()];
}

async function fetchSeedOrganisers(sb) {
  const [byEmail, byDescription] = await Promise.all([
    fetchAllRows(sb, 'organisers', 'id, name, email, description', (query) =>
      query.like('email', 'seed+%@networkerhub.example')
    ),
    fetchAllRows(sb, 'organisers', 'id, name, email, description', (query) =>
      query.eq('description', SAMPLE_ORGANISER_DESCRIPTION)
    ),
  ]);

  return [...new Map([...byEmail, ...byDescription].map((row) => [row.id, row])).values()];
}

async function eventCountsForOrganisers(sb, organiserIds) {
  const counts = Object.fromEntries(organiserIds.map((id) => [id, 0]));
  for (let i = 0; i < organiserIds.length; i += CHUNK) {
    const chunk = organiserIds.slice(i, i + CHUNK);
    const { data, error } = await sb.from('events').select('id, organiser_id').in('organiser_id', chunk);
    if (error) throw new Error(error.message);
    (data || []).forEach((row) => {
      if (row.organiser_id) counts[row.organiser_id] = (counts[row.organiser_id] || 0) + 1;
    });
  }
  return counts;
}

async function deleteEvents(sb, ids) {
  let deleted = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const { error } = await sb.from('events').delete().in('id', chunk);
    if (error) throw new Error(error.message);
    deleted += chunk.length;
  }
  return deleted;
}

async function deleteOrganisers(sb, organisers) {
  if (!organisers.length) return { deleted: 0, skipped: [] };

  const counts = await eventCountsForOrganisers(
    sb,
    organisers.map((row) => row.id)
  );
  const toDelete = [];
  const skipped = [];

  organisers.forEach((row) => {
    const eventCount = counts[row.id] || 0;
    if (eventCount > 0) {
      skipped.push({ ...row, reason: `${eventCount} event${eventCount === 1 ? '' : 's'} still linked` });
      return;
    }
    toDelete.push(row);
  });

  if (toDelete.length) {
    await unlinkOrganiserRefs(
      sb,
      toDelete.map((row) => row.id)
    );
    const { error } = await sb
      .from('organisers')
      .delete()
      .in(
        'id',
        toDelete.map((row) => row.id)
      );
    if (error) throw new Error(error.message);
  }

  return { deleted: toDelete.length, skipped };
}

function printRows(label, rows, formatter) {
  if (!rows.length) {
    console.log(`No ${label}.`);
    return;
  }
  console.log(`Found ${rows.length} ${label}:`);
  rows.slice(0, 5).forEach((row) => console.log(`  ${formatter(row)}`));
  if (rows.length > 5) console.log(`  … and ${rows.length - 5} more`);
}

async function main() {
  const { execute } = parseArgs();
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in local.env or .env');
    process.exit(1);
  }

  const sb = getSupabaseAdmin();
  const [seedBrowseEvents, sampleEvents, seedOrganisers] = await Promise.all([
    fetchSeedBrowseEvents(sb),
    fetchSampleEvents(sb),
    fetchSeedOrganisers(sb),
  ]);

  printRows(`seed browse events (${SEED_PREFIX}*)`, seedBrowseEvents, (row) => `${row.airtable_id}: ${row.title}`);
  printRows('sample events', sampleEvents, (row) => row.title);
  printRows('seed organisers', seedOrganisers, (row) => `${row.name} (${row.email})`);

  if (!seedBrowseEvents.length && !sampleEvents.length && !seedOrganisers.length) {
    console.log('\nNothing to delete.');
    return;
  }

  if (!execute) {
    console.log('\nDry run only. Pass --execute to delete.');
    return;
  }

  const eventIds = [...new Set([...seedBrowseEvents, ...sampleEvents].map((row) => row.id))];
  const deletedEvents = eventIds.length ? await deleteEvents(sb, eventIds) : 0;
  const { deleted: deletedOrganisers, skipped } = await deleteOrganisers(sb, seedOrganisers);

  console.log(`\nDeleted ${deletedEvents} seed/sample event${deletedEvents === 1 ? '' : 's'}.`);
  console.log(`Deleted ${deletedOrganisers} seed organiser${deletedOrganisers === 1 ? '' : 's'}.`);
  if (skipped.length) {
    console.log(`Skipped ${skipped.length} organiser${skipped.length === 1 ? '' : 's'} with remaining events:`);
    skipped.forEach((row) => console.log(`  ${row.name}: ${row.reason}`));
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
