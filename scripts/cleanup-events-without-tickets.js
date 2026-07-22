#!/usr/bin/env node
/**
 * Delete events that have no ticket tiers (not bookable on browse).
 *
 * Safety:
 * - Events with registrations are ALWAYS skipped (even with --force).
 * - --force only bypasses the locked-listing check for ticketless events.
 * - --execute --force also requires --confirm-force (production guard).
 *
 * Usage:
 *   node scripts/cleanup-events-without-tickets.js           # dry run
 *   node scripts/cleanup-events-without-tickets.js --execute
 *   node scripts/cleanup-events-without-tickets.js --execute --force --confirm-force
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const readline = require('readline');

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
    confirmForce: argv.includes('--confirm-force'),
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

async function deleteEvents(sb, events) {
  const { snapshotPayoutHistoryBeforeEventDelete } = require('../api/_lib/event-delete-audit');
  let deleted = 0;
  for (let i = 0; i < events.length; i += CHUNK) {
    const chunk = events.slice(i, i + CHUNK);
    for (const ev of chunk) {
      await snapshotPayoutHistoryBeforeEventDelete(sb, ev.id, ev.title || '');
    }
    const ids = chunk.map((ev) => ev.id);
    const { error } = await sb.from('events').delete().in('id', ids);
    if (error) throw new Error(error.message);
    deleted += chunk.length;
  }
  return deleted;
}

function askConfirmation(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(String(answer || '').trim().toLowerCase());
    });
  });
}

async function main() {
  const { execute, force, confirmForce } = parseArgs();
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  if (force) {
    console.warn('\n⚠️  --force is set: locked ticketless events will be deleted.');
    console.warn('   Events with registrations are still skipped.');
    console.warn('   Use Command Centre cancel/refund flows for events with bookings.\n');
  }

  if (execute && force && !confirmForce) {
    console.error(
      'Refusing to run: --execute --force requires --confirm-force.\n' +
        'Example: node scripts/cleanup-events-without-tickets.js --execute --force --confirm-force'
    );
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

  for (const ev of candidates) {
    if (withRegs.has(ev.id)) {
      skipped.push({ id: ev.id, title: ev.title, reason: 'has_registrations' });
      continue;
    }
    if (ev.locked && !force) {
      skipped.push({ id: ev.id, title: ev.title, reason: 'locked' });
      continue;
    }
    toDelete.push(ev);
  }

  console.log(`Found ${candidates.length} events without tickets.`);
  console.log(`Will delete: ${toDelete.length}, skip: ${skipped.length}`);
  if (skipped.length) {
    skipped.slice(0, 8).forEach((row) => {
      console.log(`  skip ${row.reason}: ${row.title || row.id}`);
    });
    if (skipped.length > 8) console.log(`  … and ${skipped.length - 8} more`);
  }

  if (!execute) {
    console.log('\nDry run only. Pass --execute to delete.');
    if (force) {
      console.log('With --execute --force you must also pass --confirm-force.');
    }
    return;
  }

  if (toDelete.length) {
    console.log('\nAbout to permanently delete ' + toDelete.length + ' event(s).');
    const answer = await askConfirmation('Type delete to continue: ');
    if (answer !== 'delete') {
      console.log('Aborted.');
      return;
    }
  }

  const deleted = await deleteEvents(sb, toDelete);
  console.log(`\nDeleted ${deleted} events.`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
