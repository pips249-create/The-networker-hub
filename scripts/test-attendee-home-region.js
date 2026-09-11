#!/usr/bin/env node
'use strict';

const {
  normalizeHomeRegionSlug,
  homeRegionLabel,
  hasHomeBase,
} = require('../api/_lib/attendee-home-region');
const { isAnalyticsProfileComplete } = require('../api/_lib/hub-profile-industries');

let failed = 0;

function assert(label, cond) {
  if (!cond) {
    console.error('FAIL:', label);
    failed += 1;
  }
}

assert('normalises manchester slug', normalizeHomeRegionSlug(' Manchester ') === 'manchester');
assert('rejects unknown slug', normalizeHomeRegionSlug('narnia') === '');
assert('label for cheshire', homeRegionLabel('cheshire') === 'Cheshire');
assert('hasHomeBase with slug', hasHomeBase({ homeRegionSlug: 'kent' }));
assert('hasHomeBase with legacy location', hasHomeBase({ location: 'York' }));
assert(
  'profile complete needs home base',
  !isAnalyticsProfileComplete({
    businessSector: 'Legal',
    jobTitle: 'Partner',
  }) &&
    isAnalyticsProfileComplete({
      businessSector: 'Legal',
      jobTitle: 'Partner',
      homeRegionSlug: 'surrey',
    })
);

if (failed) {
  console.error('\n' + failed + ' attendee home region check(s) failed.');
  process.exit(1);
}
console.log('All attendee home region checks passed.');
