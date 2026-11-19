#!/usr/bin/env node
/**
 * Directory carousel pool size + shared mount markup checks.
 * Run: node scripts/test-directory-browse-carousel.js
 */
const fs = require('fs');
const path = require('path');
const { EVENTS_BROWSE_CAROUSEL_SIZE } = require('../api/_lib/event-page-carousel');

let failed = 0;

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

assert('pool size is 50', EVENTS_BROWSE_CAROUSEL_SIZE === 50);

const root = path.join(__dirname, '..');
const carouselJs = fs.readFileSync(path.join(root, 'js/directory-browse-carousel.js'), 'utf8');
assert('client POOL_MAX is 50', /var POOL_MAX = 50/.test(carouselJs));
assert('exports HubDirectoryBrowseCarousel', /HubDirectoryBrowseCarousel/.test(carouselJs));

const eventsHtml = fs.readFileSync(path.join(root, 'events/index.html'), 'utf8');
assert(
  'events page mounts shared carousel',
  /data-directory-browse-carousel/.test(eventsHtml) &&
    /directory-browse-carousel\.js/.test(eventsHtml)
);

const oppHtml = fs.readFileSync(path.join(root, 'opportunities/index.html'), 'utf8');
assert(
  'opportunities page mounts shared carousel',
  /data-directory-browse-carousel/.test(oppHtml) &&
    /directory-browse-carousel\.js/.test(oppHtml)
);

const adminJs = fs.readFileSync(path.join(root, 'js/admin-app.js'), 'utf8');
assert(
  'admin browse carousel size is 50',
  /isBrowseCarousel \? 50 : 3/.test(adminJs)
);
assert(
  'admin label mentions Directory carousel',
  /Directory carousel — Events, Opportunities & Organisers \(50 slots\)/.test(adminJs)
);

const eventsJs = fs.readFileSync(path.join(root, 'js/events.js'), 'utf8');
assert(
  'events.js delegates to HubDirectoryBrowseCarousel',
  /HubDirectoryBrowseCarousel\.loadAll/.test(eventsJs)
);
const loadAdsFn = eventsJs.slice(
  eventsJs.indexOf('function loadEventsBrowseAds'),
  eventsJs.indexOf('window.hubLoadEventsBrowseAds')
);
assert(
  'loadEventsBrowseAds does not skip organisers mode',
  !/browse-mode-organisers/.test(loadAdsFn)
);

const orgCss = fs.readFileSync(path.join(root, 'css/organisers-browse.css'), 'utf8');
assert(
  'organisers mode keeps directory carousel visible',
  /events-promo-section:not\(\.events-browse-ads\)/.test(orgCss)
);

if (failed) {
  console.error('\n' + failed + ' failure(s)');
  process.exit(1);
}
console.log('\nAll directory browse carousel checks passed.');
