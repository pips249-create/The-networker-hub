#!/usr/bin/env node
/**
 * Unit checks for International events JSON-LD builder.
 */
const assert = require('assert');
const {
  buildIntlEventsItemList,
  buildEventNode,
} = require('../api/_lib/intl-events-jsonld');

const sample = [
  {
    title: 'Dublin Founders Breakfast',
    startsOn: '2026-10-24',
    startsAtLocal: '08:00',
    city: 'Dublin',
    countryCode: 'IE',
    countryName: 'Ireland',
    organiserName: 'Dublin Startups',
    organiserWebsite: 'https://example.com/org',
    description: 'Morning networking for founders.',
    externalUrl: 'https://example.com/book',
    imageUrl: 'https://example.com/img.jpg',
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
assert.equal(node.url, 'https://example.com/book');
assert.equal(node.location.address.addressCountry, 'IE');
assert.equal(node.organizer.name, 'Dublin Startups');

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

console.log('test-intl-events-jsonld: ok');
