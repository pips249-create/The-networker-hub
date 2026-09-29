#!/usr/bin/env node
/**
 * Organiser browse was scanning every historical event (and the oldest 16
 * venues) inside a 15s function limit, so /api/organisers 504'd and city
 * pages missed groups that meet there now.
 *
 * Run: node scripts/test-organiser-browse-directory.js
 */
const fs = require('fs');
const path = require('path');
const {
  indexPublicOrganiserEvents,
  DIRECTORY_EVENT_QUERY,
  DIRECTORY_ORG_SELECT,
} = require('../api/_lib/supabase-organisers-browse');

let failed = 0;

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

function eventRow(id, organiserId, startsAt, city) {
  return {
    id: id,
    organiser_id: organiserId,
    starts_at: startsAt,
    approval_status: 'Approved',
    status: 'published',
    city: city,
    postcode: '',
    outcode: city.slice(0, 3).toUpperCase(),
    location_label: city,
    venue: city + ' hall',
  };
}

const published = {
  id: 'org-1',
  name: 'Manchester Circle',
  listing_status: 'published',
  verification_status: 'Verified',
};
const draftVerified = {
  id: 'org-draft',
  name: 'Hidden Draft',
  listing_status: 'draft',
  verification_status: 'Verified',
};

const events = [];
for (let i = 0; i < 20; i++) {
  const day = String(i + 1).padStart(2, '0');
  events.push(eventRow('old-' + i, 'org-1', '2020-01-' + day + 'T10:00:00.000Z', 'OldCity' + i));
}
events.push(eventRow('new-1', 'org-1', '2026-09-01T10:00:00.000Z', 'Manchester'));
events.push(eventRow('draft-ev', 'org-draft', '2026-09-02T10:00:00.000Z', 'Manchester'));

const { counts, locationsByOrg } = indexPublicOrganiserEvents([published, draftVerified], events);
const locations = locationsByOrg.get('org-1') || [];

assert('upcoming-style index counts every public event passed in', counts.get('org-1') === 21);
assert('draft organiser events stay off the directory', !counts.has('org-draft'));
assert('location cap stays at 16', locations.length === 16);
assert(
  'newest venue is kept for city matching',
  locations.some((location) => location.city === 'Manchester')
);
assert(
  'oldest venue is dropped once the cap fills',
  !locations.some((location) => location.city === 'OldCity0')
);
assert('directory event query is upcoming-only and slim', DIRECTORY_EVENT_QUERY.upcomingOnly === true);
assert(
  'directory event query does not select *',
  DIRECTORY_EVENT_QUERY.select !== '*' && DIRECTORY_EVENT_QUERY.select.indexOf('organiser_id') !== -1
);
assert('directory organiser columns skip select *', DIRECTORY_ORG_SELECT !== '*' && DIRECTORY_ORG_SELECT.indexOf('email') === -1);

const browseSrc = fs.readFileSync(
  path.join(__dirname, '../api/_lib/supabase-organisers-browse.js'),
  'utf8'
);
assert(
  'directory builder uses the upcoming event query',
  /fetchPublishedEventRows\(sb,\s*DIRECTORY_EVENT_QUERY\)/.test(browseSrc)
);

const clientSrc = fs.readFileSync(path.join(__dirname, '../js/organisers.js'), 'utf8');
assert('browser retries gateway timeouts', /HTTP \(408\|425\|429\|502\|503\|504\)/.test(clientSrc));

const middlewareSrc = fs.readFileSync(path.join(__dirname, '../middleware.js'), 'utf8');
const fnMatch = middlewareSrc.match(
  /function absolutizeDirectoryTemplateAssets\(html\) \{[\s\S]*?\n\}/
);
assert('middleware absolutizes template assets', Boolean(fnMatch));

if (fnMatch) {
  const absolutize = new Function(fnMatch[0] + '\nreturn absolutizeDirectoryTemplateAssets;')();
  const html = [
    '<link rel="stylesheet" href="../css/hub.css?v=1">',
    '<script src="../js/organisers.js?v=1" defer></script>',
    '<script src="../js/hub-defer-css.js" data-hrefs="../css/fact-loader.css|../css/organisers-browse.css"></script>',
    '<script src="../js/site-nav.js" data-root="../"></script>',
    '<a href="/events/?mode=organisers">Organisers</a>',
  ].join('\n');
  const out = absolutize(html);
  assert('css becomes root-absolute', out.indexOf('href="/css/hub.css?v=1"') !== -1);
  assert('js becomes root-absolute', out.indexOf('src="/js/organisers.js?v=1"') !== -1);
  assert('deferred css list becomes root-absolute', out.indexOf('data-hrefs="/css/fact-loader.css|/css/organisers-browse.css"') !== -1);
  assert('data-root becomes /', out.indexOf('data-root="/"') !== -1);
  assert('absolute organiser link is unchanged', out.indexOf('href="/events/?mode=organisers"') !== -1);
  assert('no relative css left', out.indexOf('../css/') === -1);
}

const vercel = fs.readFileSync(path.join(__dirname, '../vercel.json'), 'utf8');
assert(
  'organisers function has room past a cold catalogue read',
  /"api\/organisers\.js":\s*\{\s*"maxDuration":\s*30\s*\}/.test(vercel)
);

if (failed) {
  console.error('\n' + failed + ' check(s) failed');
  process.exit(1);
}
console.log('\nAll organiser browse directory checks passed');
