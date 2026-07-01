#!/usr/bin/env node
/**
 * Delete events that have no ticket tiers (not bookable on browse).
 * Skips events with registrations or locked listings unless --force.
 *
 * Usage:
 *   node scripts/cleanup-events-without-tickets.js           # dry run
 *   node scripts/cleanup-events-without-tickets.js --execute
 *   node scripts/cleanup-events-without-tickets.js --execute --force
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env.local') });
dotenv.config({ path: path.join(root, '.env') });

const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');

const CHUNK = 80;

function parseArgs() {
  const argv = process.argv.slice(2);
  return {
    execute: argv.includes('--execute'),
    force: argv.includes('--force'),
  };
}

async function eventIdsWithRegistrations(sb, eventIds) {
  const blocked = new Set();
  for (let i = 0; i < eventIds.length; i += CHUNK) {
    const chunk = eventIds.slice(i, i + CHUNK);
    const { data, error } = await sb.from('registrations').select('event_id').in('event_id', chunk);
    if (error) throw new Error(error.message);
    (data || []).forEach((row) => {
      if (row.event_id) blocked.add(row.event_id);
    });
  }
  return blocked;
}

async function findEventsWithoutTickets(sb) {
  const [{ data: events, error: evErr }, { data: tickets, error: tErr }] = await Promise.all([
    sb.from('events').select('id, title, status, approval_status, locked'),
    sb.from('tickets').select('event_id'),
  ]);
  if (evErr) throw new Error(evErr.message);
  if (tErr) throw new Error(tErr.message);

  const withTickets = new Set((tickets || []).map((t) => t.event_id).filter(Boolean));
  return (events || []).filter((ev) => !withTickets.has(ev.id));
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

async function main() {
  const { execute, force } = parseArgs();
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  const sb = getSupabaseAdmin();
  const candidates = await findEventsWithoutTickets(sb);
  if (!candidates.length) {
    console.log('No events without tickets.');
    return;
  }

  const withRegs = await eventIdsWithRegistrations(
    sb,
    candidates.map((ev) => ev.id)
  );

  const toDelete = [];
  const skipped = [];

  candidates.forEach((ev) => {
    if (withRegs.has(ev.id)) {
      skipped.push({ id: ev.id, title: ev.title, reason: 'has_registrations' });
      return;
    }
    if (ev.locked && !force) {
      skipped.push({ id: ev.id, title: ev.title, reason: 'locked' });
      return;
    }
    toDelete.push(ev);
  });

  console.log(`Found ${candidates.length} events without tickets.`);
  console.log(`Will delete: ${toDelete.length}, skip: ${skipped.length}`);
  if (skipped.length) {
    skipped.slice(0, 5).forEach((row) => {
      console.log(`  skip ${row.reason}: ${row.title || row.id}`);
    });
    if (skipped.length > 5) console.log(`  … and ${skipped.length - 5} more`);
  }

  if (!execute) {
    console.log('\nDry run only. Pass --execute to delete.');
    return;
  }

  const deleted = await deleteEvents(
    sb,
    toDelete.map((ev) => ev.id)
  );
  console.log(`\nDeleted ${deleted} events.`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
