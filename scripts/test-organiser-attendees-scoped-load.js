#!/usr/bin/env node
/**
 * Franchise catalogues (Top Clubs / TOP Networking) hit the attendees?eventId=all
 * 80-event cap. Picking a specific meeting must fetch that event (or series)
 * without the cap, and the UI must explain the truncated All-events preview.
 *
 * Run: node scripts/test-organiser-attendees-scoped-load.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dash = fs.readFileSync(path.join(root, 'js/organiser-dashboard.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'organiser/index.html'), 'utf8');
const api = fs.readFileSync(path.join(root, 'api/_lib/routes/organiser-attendees.js'), 'utf8');

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
  'API accepts eventIds for series-scoped attendee loads',
  /eventIdsParam/.test(api) && /url\.searchParams\.get\('eventIds'\)/.test(api)
);
assert(
  'API skips the all-events cap when a concrete event/series is requested',
  /Explicit event \/ series scope skips the franchise "all events" cap/.test(api)
);
assert(
  'dashboard builds scoped attendees API queries',
  /function attendeesApiQueryForScope/.test(dash) &&
    /eventIds=' \+ ids\.map\(encodeURIComponent\)\.join\(','\)/.test(dash)
);
assert(
  'dashboard reloads attendees when the event filter scope changes',
  /attendeesLoadedScope/.test(dash) &&
    /needsReload/.test(dash) &&
    /ensureAttendeesLoaded\(\{ force: true \}\)/.test(dash)
);
assert(
  'truncated All-events note is rendered in the Attendees panel',
  /id="attendees-truncated-note"/.test(html) &&
    /attendees-truncated-note/.test(dash) &&
    /newest events only/.test(dash)
);
assert(
  'organiser dashboard cache key bumped for Top Clubs attendees fix',
  /organiser-dashboard\.js\?v=20261030topclubsatt1/.test(html)
);

if (failed) {
  console.error('\n' + failed + ' check(s) failed');
  process.exit(1);
}
console.log('\nok: scoped Top Clubs attendees loading guards present');
