#!/usr/bin/env node
/**
 * My Events list: keep the first paint cheap and avoid a second full workspace reload.
 * Run: node scripts/test-organiser-events-list-perf.js
 */
const fs = require('fs');
const path = require('path');
const {
  applyRegistrationSalesToEventList,
} = require('../api/_lib/supabase-organiser-payouts');

let failed = 0;

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

const events = [
  { id: 'ev-1', title: 'Pip’s Test', ticketsCapacity: 20 },
  { id: 'ev-2', title: 'The Networker Hub', ticketsCapacity: 0 },
];
const registrations = [
  { event_id: 'ev-1', payment_status: 'Paid', quantity: 2, ticket_price: 10 },
  { event_id: 'ev-1', payment_status: 'Refunded', quantity: 1, ticket_price: 10 },
  { event_id: 'ev-1', payment_status: 'Paid', quantity: 1, cancelled_at: '2026-09-01' },
  { event_id: 'ev-2', payment_status: 'Free', quantity: 3 },
];

const enriched = applyRegistrationSalesToEventList(events, registrations, []);
assert('keeps both events', enriched.length === 2);
assert('counts paid seats only on first event', enriched[0].ticketsSold === 2);
assert('shows capacity in sold label', enriched[0].ticketsSoldLabel === '2 / 20');
assert('counts free seats on second event', enriched[1].ticketsSold === 3);
assert('empty list stays empty', applyRegistrationSalesToEventList([], registrations, []).length === 0);
assert(
  'same registration set can enrich two lists without a second fetch',
  applyRegistrationSalesToEventList([events[1]], registrations, [])[0].ticketsSold === 3
);

const dash = fs.readFileSync(path.join(__dirname, '../js/organiser-dashboard.js'), 'utf8');
const eventsLib = fs.readFileSync(
  path.join(__dirname, '../api/_lib/supabase-organiser-events.js'),
  'utf8'
);
const mutationFn = dash.slice(
  dash.indexOf('async function refreshEventsWorkspaceAfterMutation'),
  dash.indexOf('async function submitDeleteEvent')
);
const duplicateFn = dash.slice(
  dash.indexOf('async function submitDuplicateEvent'),
  dash.indexOf('function confirmDuplicateEvent')
);
const eventsOnlyFn = eventsLib.slice(
  eventsLib.indexOf('const eventsOnly = String(req.query?.eventsOnly'),
  eventsLib.indexOf('let displayName = session.name')
);

assert(
  'lean bootstrap keeps cached events instead of wiping to []',
  /incomingEvents\.length \|\| !state\.eventsLoaded/.test(dash) &&
    /Keep a usable cache/.test(dash)
);
assert(
  'mutation refresh reloads events only — not a full lean bootstrap',
  /await ensureEventsLoaded\(\{ force: true \}\)/.test(mutationFn) &&
    !/loadBootstrap/.test(mutationFn)
);
assert(
  'saving an event from the drawer refreshes the list, not the full workspace',
  /hub-event-saved[\s\S]{0,400}refreshEventsWorkspaceAfterMutation/.test(dash) &&
    !/hub-event-saved[\s\S]{0,400}loadBootstrap\(\)\.then\(renderAll\)/.test(dash)
);
assert(
  'duplicating an event refreshes the list, not the full workspace',
  /refreshEventsWorkspaceAfterMutation/.test(duplicateFn) && !/loadBootstrap/.test(duplicateFn)
);
assert(
  'events list query sends eventsLite and known total',
  /eventsLite=1/.test(dash) && /eventsTotal=' \+ String\(state\.eventsTotal\)/.test(dash)
);
assert(
  'header stats load in the background',
  dash.includes("api('/api/organiser/workspace-stats')") &&
    dash.includes('function ensureWorkspaceStatsLoaded')
);
assert(
  'route spinner does not wait for enrichment when the list can paint',
  /eventsPainted \? Promise\.resolve\(\) : eventsLoad/.test(dash)
);
assert(
  'eventsOnly path skips pending claims and setup reviews',
  /loadOrganiserEventsPage/.test(eventsOnlyFn) &&
    !/pendingClaimGroups/.test(eventsOnlyFn) &&
    !/pendingSetupReviews/.test(eventsOnlyFn) &&
    !/findUserByEmail/.test(eventsOnlyFn)
);
assert(
  'lite events page loads events in parallel with counts',
  /const \[groupEventCounts, upcomingRaw, total, events\] = await Promise\.all/.test(eventsLib)
);
assert(
  'registration sales are applied from one fetch',
  /applyRegistrationSalesToEventList\(overviewEvents, regs, cancellations\)/.test(eventsLib)
);

if (failed) {
  console.error('\n' + failed + ' check(s) failed');
  process.exit(1);
}
console.log('\ntest-organiser-events-list-perf: ok');
