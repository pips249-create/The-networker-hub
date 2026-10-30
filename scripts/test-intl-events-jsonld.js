#!/usr/bin/env node
/**
 * Unit checks for International events JSON-LD builder.
 * Covers Google Search Console Event recommended fields.
 */
const assert = require('assert');
const {
  buildIntlEventsItemList,
  buildEventNode,
  currencyForCountry,
} = require('../api/_lib/intl-events-jsonld');

const sample = [
  {
    title: 'Dublin Founders Breakfast',
    startsOn: '2026-10-24',
    startsAtLocal: '08:00',
    endsOn: '2026-10-24',
    city: 'Dublin',
    countryCode: 'IE',
    countryName: 'Ireland',
    organiserName: 'Dublin Startups',
    organiserWebsite: 'https://example.com/org',
    description: 'Morning networking for founders.',
    externalUrl: 'https://example.com/book',
    imageUrl: 'https://example.com/img.jpg',
    createdAt: '2026-09-01T09:00:00.000Z',
  },
  {
    title: 'Missing link',
    startsOn: '2026-11-01',
    city: 'Berlin',
    countryCode: 'DE',
  },
];

const node = buildEventNode(sample[0]);
assert.equal(node['@type'], 'Event');
assert.equal(node.startDate, '2026-10-24T08:00:00');
assert.equal(node.endDate, '2026-10-24T08:00:00');
assert.equal(node.description, 'Morning networking for founders.');
assert.equal(node.url, 'https://example.com/book');
assert.equal(node.location.address.addressCountry, 'IE');
assert.equal(node.organizer.name, 'Dublin Startups');
assert.equal(node.performer['@type'], 'PerformingGroup');
assert.equal(node.performer.name, 'Dublin Startups');
assert.equal(node.performer.url, 'https://example.com/org');
assert.equal(node.offers.price, 0);
assert.equal(node.offers.priceCurrency, 'EUR');
assert.equal(node.offers.validFrom, '2026-09-01T09:00:00.000Z');

assert.equal(buildEventNode(sample[1]), null);

const list = buildIntlEventsItemList(sample);
assert.equal(list['@type'], 'ItemList');
assert.equal(list.numberOfItems, 1);
assert.equal(list.itemListElement.length, 1);
assert.equal(list.itemListElement[0].item.name, 'Dublin Founders Breakfast');

const onlineList = buildIntlEventsItemList([
  {
    title: 'Global Founders Zoom',
    startsOn: '2026-11-01',
    startsAtLocal: '17:00',
    city: 'Online',
    countryCode: 'OL',
    countryName: 'Online',
    externalUrl: 'https://example.com/zoom',
  },
]);
assert.equal(
  onlineList.itemListElement[0].item.eventAttendanceMode,
  'https://schema.org/OnlineEventAttendanceMode'
);
assert.equal(onlineList.itemListElement[0].item.location['@type'], 'VirtualLocation');
assert.ok(onlineList.itemListElement[0].item.endDate);
assert.ok(onlineList.itemListElement[0].item.description);
assert.equal(onlineList.itemListElement[0].item.offers.priceCurrency, 'USD');

const noDesc = buildEventNode({
  title: 'Halifax Conference',
  startsOn: '2026-11-04',
  startsAtLocal: '09:30:00',
  endsOn: '2026-11-04',
  city: 'Halifax',
  countryCode: 'CA',
  countryName: 'Canada',
  organiserName: 'Health Association Nova Scotia',
  externalUrl: 'https://example.com/halifax',
  createdAt: '2026-10-20T14:59:46.637Z',
});
assert.ok(noDesc.description.indexOf('Halifax') !== -1);
assert.ok(noDesc.description.indexOf('Health Association Nova Scotia') !== -1);
assert.equal(noDesc.endDate, '2026-11-04T09:30:00');
assert.equal(noDesc.offers.priceCurrency, 'CAD');
assert.equal(noDesc.offers.validFrom, '2026-10-20T14:59:46.637Z');
assert.equal(noDesc.performer.name, 'Health Association Nova Scotia');

assert.equal(currencyForCountry('US'), 'USD');
assert.equal(currencyForCountry('GB'), 'GBP');

console.log('test-intl-events-jsonld: ok');
