/**
 * County landing matching for /opportunities/networking/:county.
 * Run: node scripts/test-opportunity-county-match.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const catalogPath = path.join(__dirname, '..', 'js', 'opportunities-catalog.js');
const src = fs.readFileSync(catalogPath, 'utf8');

const sandbox = {
  window: {},
  console,
};
sandbox.window.HubOpportunityListingConstants = null;
sandbox.window.HubPublicUrls = null;
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

const catalog = sandbox.window.HubOpportunitiesCatalog;
if (!catalog || typeof catalog.listingMatchesCountySlug !== 'function') {
  console.error('HubOpportunitiesCatalog.listingMatchesCountySlug missing');
  process.exit(1);
}

let failed = 0;
function assert(label, condition) {
  if (condition) {
    console.log('  ok  ' + label);
    return;
  }
  failed += 1;
  console.error('  FAIL  ' + label);
}

function listing(loc, extra) {
  return catalog.normalizeListing(
    Object.assign(
      {
        id: 't-' + String(loc || 'x').replace(/\W+/g, '-'),
        title: 'Test opportunity',
        desc: 'Sample listing',
        type: 'franchise',
        tags: ['franchise'],
        host: 'Test Host',
        meta: [{ key: 'Location', val: loc }],
        category: 'general',
      },
      extra || {}
    ),
    0
  );
}

console.log('Opportunity county matching');

assert(
  'Reading town maps onto Berkshire county page',
  catalog.listingMatchesCountySlug(listing('Reading'), 'berkshire', 'Berkshire')
);
assert(
  'Maidenhead text matches Berkshire',
  catalog.listingMatchesCountySlug(listing('Maidenhead'), 'berkshire', 'Berkshire')
);
assert(
  'Leeds maps onto Yorkshire county page',
  catalog.listingMatchesCountySlug(listing('Leeds'), 'yorkshire', 'Yorkshire')
);
assert(
  'Yorkshire label still matches Yorkshire',
  catalog.listingMatchesCountySlug(listing('Yorkshire'), 'yorkshire', 'Yorkshire')
);
assert(
  'Chester maps onto Cheshire',
  catalog.listingMatchesCountySlug(listing('Chester'), 'cheshire', 'Cheshire')
);
assert(
  'Brighton maps onto Sussex',
  catalog.listingMatchesCountySlug(listing('Brighton'), 'sussex', 'Sussex')
);
assert(
  'Bournemouth maps onto Dorset',
  catalog.listingMatchesCountySlug(listing('Bournemouth'), 'dorset', 'Dorset')
);
assert(
  'Milton Keynes maps onto Buckinghamshire',
  catalog.listingMatchesCountySlug(listing('Milton Keynes'), 'buckinghamshire', 'Buckinghamshire')
);
assert(
  'Exeter maps onto Devon',
  catalog.listingMatchesCountySlug(listing('Exeter, Devon'), 'devon', 'Devon')
);
assert(
  'UK-wide matches every county',
  catalog.listingMatchesCountySlug(listing('UK-wide'), 'norfolk', 'Norfolk')
);
assert(
  'Manchester does not match Berkshire',
  !catalog.listingMatchesCountySlug(listing('Manchester'), 'berkshire', 'Berkshire')
);

const reading = listing('Reading');
assert('Reading listing receives berkshire citySlug', reading.citySlugs.indexOf('berkshire') !== -1);
assert('Reading listing keeps reading citySlug', reading.citySlugs.indexOf('reading') !== -1);

const leeds = listing('Leeds');
assert('Leeds listing receives yorkshire citySlug', leeds.citySlugs.indexOf('yorkshire') !== -1);

if (failed) {
  console.error('\n' + failed + ' check(s) failed.');
  process.exit(1);
}
console.log('\nAll opportunity county matching checks passed.');
