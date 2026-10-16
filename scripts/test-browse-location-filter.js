#!/usr/bin/env node
/**
 * Location filter mode:
 * - major metros + full postcodes → mile radius
 * - smaller cities / counties / outcodes → postcode sectors
 * - metro city pages also keep their own postcode sectors (OR with radius)
 */
const assert = require('assert');
const {
  outcodeListForLocation,
  parseFullUkPostcode,
  cityRegionFromInput,
  isMetroRadiusRegion,
  REGION_SECTORS,
  haversineMiles,
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

/** Mirrors browse-events-query metro sector fallback for unit coverage. */
function metroCityRegion(location) {
  const raw = String(location || '').trim();
  if (!raw || parseFullUkPostcode(raw)) return null;
  const region = cityRegionFromInput(raw);
  if (!region || !isMetroRadiusRegion(region)) return null;
  return region;
}

function rowPassesMetroOrRadius(row, location, center, radiusMi) {
  if (row.format_tab === 'online') return true;
  const region = metroCityRegion(location);
  if (region) {
    const outcodes = outcodeListForLocation(location);
    const oc = String(row.outcode || '')
      .trim()
      .toUpperCase();
    if (oc && outcodes && outcodes.includes(oc)) return true;
    const hay = [row.city, row.location_label].filter(Boolean).join(' ').toLowerCase();
    if (hay.includes(region.replace(/-/g, ' '))) return true;
  }
  const lat = row.latitude != null ? Number(row.latitude) : null;
  const lng = row.longitude != null ? Number(row.longitude) : null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return haversineMiles(center[0], center[1], lat, lng) <= radiusMi;
}

assert(cityRegionFromInput('Chester') === 'chester');
assert(!isMetroRadiusRegion('chester'));
assert(isMetroRadiusRegion('birmingham'));
assert(isMetroRadiusRegion('manchester'));
assert(isMetroRadiusRegion('liverpool'));
assert(isMetroRadiusRegion('glasgow'));

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
assert(!prefersOutcodeLocation('Glasgow'));
assert(!prefersOutcodeLocation('Tarporley'));

assert(prefersGeoRadius('Birmingham'));
assert(prefersGeoRadius('Glasgow'));
assert(prefersGeoRadius('CH1 2AB'));
assert(!prefersGeoRadius('Chester'));
assert(!prefersGeoRadius('CH1'));

const glasgowOutcodes = outcodeListForLocation('Glasgow');
assert(Array.isArray(glasgowOutcodes));
assert(glasgowOutcodes.includes('G1'));
assert(glasgowOutcodes.includes('G75'), 'East Kilbride G75 belongs on Glasgow networking');
assert(glasgowOutcodes.includes('G84'), 'Helensburgh G84 belongs on Glasgow networking');
assert(glasgowOutcodes.includes('G70'));
assert(glasgowOutcodes.includes('G79'));
assert(REGION_SECTORS.glasgow.includes('G75'));

assert(metroCityRegion('Glasgow') === 'glasgow');
assert(metroCityRegion('G1 1AA') === null);
assert(metroCityRegion('Chester') === null);

// Helensburgh (~21 mi) is outside the default 15 mi radius but has a Glasgow sector.
const glasgowCenter = [55.8642, -4.2518];
assert(
  !rowPassesMetroOrRadius(
    { outcode: 'PA1', latitude: 55.9969, longitude: -4.7326, format_tab: 'in-person' },
    'Glasgow',
    glasgowCenter,
    15
  ),
  'non-Glasgow outcode outside radius stays excluded'
);
assert(
  rowPassesMetroOrRadius(
    { outcode: 'G84', latitude: 55.9969, longitude: -4.7326, format_tab: 'in-person' },
    'Glasgow',
    glasgowCenter,
    15
  ),
  'G84 Glasgow-sector event outside radius still matches'
);
assert(
  rowPassesMetroOrRadius(
    { outcode: 'G75', latitude: null, longitude: null, format_tab: 'in-person' },
    'Glasgow',
    glasgowCenter,
    15
  ),
  'G75 event without coords still matches via sector'
);
assert(
  rowPassesMetroOrRadius(
    { outcode: null, city: 'Glasgow', latitude: null, longitude: null, format_tab: 'in-person' },
    'Glasgow',
    glasgowCenter,
    15
  ),
  'city-name-only Glasgow listing still matches'
);

console.log('test-browse-location-filter: ok');
