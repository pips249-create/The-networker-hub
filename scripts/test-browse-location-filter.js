#!/usr/bin/env node
/**
 * Location filter mode:
 * - major metros + full postcodes → mile radius
 * - smaller cities / counties / outcodes → postcode sectors
 */
const assert = require('assert');
const {
  outcodeListForLocation,
  parseFullUkPostcode,
  cityRegionFromInput,
  isMetroRadiusRegion,
} = require('../api/_lib/uk-outcode');

function prefersOutcodeLocation(location, outcodes) {
  const raw = String(location || '').trim();
  if (!raw) return false;
  if (parseFullUkPostcode(raw)) return false;
  const region = cityRegionFromInput(raw);
  if (region && isMetroRadiusRegion(region)) return false;
  const list = outcodeListForLocation(raw, outcodes);
  return !!(list && list.length);
}

function prefersGeoRadius(location) {
  const raw = String(location || '').trim();
  if (!raw) return false;
  if (parseFullUkPostcode(raw)) return true;
  const region = cityRegionFromInput(raw);
  return !!(region && isMetroRadiusRegion(region));
}

assert(cityRegionFromInput('Chester') === 'chester');
assert(!isMetroRadiusRegion('chester'));
assert(isMetroRadiusRegion('birmingham'));
assert(isMetroRadiusRegion('manchester'));
assert(isMetroRadiusRegion('liverpool'));

const chesterOutcodes = outcodeListForLocation('Chester');
assert(Array.isArray(chesterOutcodes));
assert(chesterOutcodes.includes('CH1'));
assert(!chesterOutcodes.includes('L1'));

assert(prefersOutcodeLocation('Chester'));
assert(prefersOutcodeLocation('Cambridge'));
assert(prefersOutcodeLocation('Oxford'));
assert(prefersOutcodeLocation('Brighton'));
assert(prefersOutcodeLocation('CH1'));
assert(!prefersOutcodeLocation('CH1 2AB'));
assert(!prefersOutcodeLocation('Birmingham'));
assert(!prefersOutcodeLocation('Manchester'));
assert(!prefersOutcodeLocation('Liverpool'));
assert(!prefersOutcodeLocation('Tarporley'));

assert(prefersGeoRadius('Birmingham'));
assert(prefersGeoRadius('CH1 2AB'));
assert(!prefersGeoRadius('Chester'));
assert(!prefersGeoRadius('CH1'));

console.log('test-browse-location-filter: ok');
