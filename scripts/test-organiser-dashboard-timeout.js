#!/usr/bin/env node
/**
 * Guard rails for the organiser dashboard timeout that left My events /
 * Attendees empty ("Could not load dashboard: Request timed out"), including
 * the Sentry stack refresh → loadBootstrap → apiWithTimeout on #events-list.
 *
 * Run: node scripts/test-organiser-dashboard-timeout.js
 */
const fs = require('fs');
const path = require('path');
const { shouldScanAllPlatformEvents } = require('../api/_lib/organiser-event-scope');

let failed = 0;

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

assert(
  'admin with known group ids must not scan the whole platform',
  shouldScanAllPlatformEvents(['org-1', 'org-2'], true) === false
);
assert(
  'personal workspace never scans the whole platform',
  shouldScanAllPlatformEvents(['org-1'], false) === false
);
assert(
  'empty scope without allEvents stays empty',
  shouldScanAllPlatformEvents([], false) === false
);
assert(
  'allEvents with no group ids is the only platform-wide scan',
  shouldScanAllPlatformEvents([], true) === true
);
assert(
  'null group list with allEvents still scans (legacy admin fallback)',
  shouldScanAllPlatformEvents(null, true) === true
);

const root = path.join(__dirname, '..');
const dash = fs.readFileSync(path.join(root, 'js/organiser-dashboard.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'organiser/index.html'), 'utf8');
const lean = fs.readFileSync(path.join(root, 'api/_lib/supabase-organiser-events.js'), 'utf8');
const attendees = fs.readFileSync(path.join(root, 'api/_lib/routes/organiser-attendees.js'), 'utf8');
const scope = fs.readFileSync(path.join(root, 'api/_lib/organiser-api-scope.js'), 'utf8');
const bootstrap = fs.readFileSync(path.join(root, 'api/_lib/routes/organiser-bootstrap.js'), 'utf8');
const sentry = fs.readFileSync(path.join(root, 'js/hub-sentry.js'), 'utf8');

assert(
  'dashboard has a groups-only bootstrap fallback after timeout',
  /fetchOrganiserBootstrap/.test(dash) &&
    /bootstrap\?groupsOnly=1/.test(dash) &&
    /BOOTSTRAP_TIMEOUT_MS/.test(dash)
);
assert(
  'first-load bootstrap waits longer than the old 30s abort',
  /const BOOTSTRAP_TIMEOUT_MS = 45000/.test(dash)
);
assert(
  'silent refresh defaults to groups-only so hash/pageshow cannot re-hit lean bootstrap',
  /async function refresh\(options\)/.test(dash) &&
    /groupsOnly: !full/.test(dash) &&
    /silent refresh failed/.test(dash)
);
assert(
  'scope switches still request a full workspace refresh',
  /refresh\(\{\s*full:\s*true\s*\}\)/.test(dash)
);
assert(
  'attendees list uses a bounded timeout instead of hanging the tab',
  /ATTENDEES_TIMEOUT_MS/.test(dash) &&
    /apiWithTimeout\(\s*['"]\/api\/organiser\/attendees\?eventId=all['"]/.test(dash)
);
assert(
  'HTML cache key bumped so browsers pick up the timeout fix',
  /organiser-dashboard\.js\?v=20260923refreshlite/.test(html)
);
assert(
  'Sentry ignores handled bootstrap timeout noise',
  /Request timed out/i.test(sentry)
);
assert(
  'lean admin bootstrap skips event summaries',
  /const skipEventSummaries = adminView/.test(lean)
);
assert(
  'API scope no longer treats admin view as every platform event',
  /listEventIdsForOrganiserGroups\(groupIds, false\)/.test(scope)
);
assert(
  'attendees?eventId=all caps large workspaces',
  /ATTENDEES_ALL_EVENT_LIMIT/.test(attendees)
);
assert(
  'groups-only bootstrap returns admin/personal scope flags for the fallback',
  /personalScope/.test(bootstrap) && /adminView/.test(bootstrap)
);

if (failed) {
  console.error('\n' + failed + ' check(s) failed');
  process.exit(1);
}
console.log('\nAll organiser dashboard timeout checks passed');
