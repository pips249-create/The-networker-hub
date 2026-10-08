#!/usr/bin/env node
/**
 * City hub FAQs must be unique per city and name the districts we already cover.
 * Counties stay on the shared template.
 */
const assert = require('assert');
const { NETWORKING_CITY_SLUGS, getNetworkingRegion } = require('../api/_lib/networking-regions');
const { NETWORKING_COUNTY_SLUGS } = require('../api/_lib/networking-county-sectors');
const {
  getCityNetworkingFaqs,
  getCityFaqLocalTerms,
  inventorySentence,
} = require('../api/_lib/networking-city-faqs');
const {
  buildNetworkingRegionFaqs,
  buildNetworkingRegionFaqSchema,
} = require('../api/_lib/networking-region-content');

function stem(question, name) {
  return String(question || '')
    .toLowerCase()
    .split(String(name || '').toLowerCase())
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

assert.strictEqual(
  inventorySentence(9, 86),
  'There are currently 9 listings, covering 86 upcoming dates. Each listing is one group.'
);
assert.strictEqual(inventorySentence(0, 0), 'New meetings are added as organisers publish them.');
assert.strictEqual(inventorySentence(1, 1), 'There are currently 1 upcoming listing.');

const signatures = new Set();
const answerBodies = new Set();

NETWORKING_CITY_SLUGS.forEach(function (slug) {
  const region = getNetworkingRegion(slug);
  assert.ok(region, 'missing region ' + slug);
  const faqs = getCityNetworkingFaqs(slug, 4, 12);
  assert.ok(faqs && faqs.length >= 4, slug + ' needs at least 4 FAQs');

  const signature = faqs.map(function (item) { return stem(item.question, region.name); }).join(' | ');
  assert.ok(!signatures.has(signature), 'duplicate FAQ question pattern: ' + slug);
  signatures.add(signature);

  const combined = faqs.map(function (item) { return item.question + ' ' + item.answer; }).join(' ');
  faqs.forEach(function (item) {
    assert.ok(item.question.indexOf(region.name) !== -1, slug + ' question missing city name: ' + item.question);
    assert.ok(item.answer.length > 80, slug + ' answer too short: ' + item.question);
    assert.ok(!/\{inventory\}/.test(item.answer), slug + ' left an inventory token');
    assert.ok(!/\/for-organisers/.test(item.answer), slug + ' should not print a raw path');
    assert.ok(!/\/networking\//.test(item.answer), slug + ' should not print a raw path');
  });
  assert.ok(combined.indexOf('There are currently 4 listings') !== -1, slug + ' missing live count');

  const places = getCityFaqLocalTerms(slug);
  assert.ok(places && places.length, slug + ' missing local terms');
  places.forEach(function (place) {
    assert.ok(
      combined.toLowerCase().indexOf(String(place).toLowerCase()) !== -1,
      slug + ' answer missing “' + place + '”'
    );
  });

  const body = faqs
    .map(function (item) { return stem(item.answer, region.name); })
    .join(' ')
    .replace(/there are currently 4 listings, covering 12 upcoming dates\. each listing is one group\./gi, '');
  assert.ok(!answerBodies.has(body), 'duplicate FAQ answers after removing the city name: ' + slug);
  answerBodies.add(body);

  const built = buildNetworkingRegionFaqs(region, 4, 'ignored tagline', 12);
  assert.strictEqual(built[0].question, faqs[0].question, slug + ' builder did not use city FAQs');

  const schema = buildNetworkingRegionFaqSchema(built, 'https://www.thenetworkeruk.com' + region.path);
  assert.strictEqual(schema.mainEntity.length, built.length);
  assert.strictEqual(schema.mainEntity[0].name, built[0].question);
});

NETWORKING_COUNTY_SLUGS.forEach(function (slug) {
  assert.strictEqual(getCityNetworkingFaqs(slug, 2, 2), null, slug + ' should stay on the shared template');
  const region = getNetworkingRegion(slug);
  const faqs = buildNetworkingRegionFaqs(region, 2, 'From one town to another.', 2);
  assert.ok(faqs[0].question.indexOf(region.name) !== -1, slug + ' county FAQ missing name');
  assert.ok(
    faqs.some(function (item) { return /list my networking group/i.test(item.question); }),
    slug + ' county FAQ dropped the organiser question'
  );
});

const manchester = getCityNetworkingFaqs('manchester', 9, 86);
assert.ok(/Networking in Manchester/.test(manchester[0].answer));
assert.ok(/Northern Quarter/.test(manchester[1].answer));
assert.ok(/breakfast networking in Manchester/i.test(manchester[2].question + manchester[2].answer));

const birmingham = getCityNetworkingFaqs('birmingham', 28, 131);
assert.ok(/Digbeth/.test(birmingham.map(function (item) { return item.answer; }).join(' ')));
assert.ok(/Colmore Row/.test(birmingham.map(function (item) { return item.answer; }).join(' ')));

const cardiff = getCityNetworkingFaqs('cardiff', 0, 0);
assert.ok(/Cardiff Bay/.test(cardiff.map(function (item) { return item.answer; }).join(' ')));
assert.ok(/New meetings are added as organisers publish them/.test(cardiff[0].answer));
assert.ok(!/0 listings/.test(cardiff[0].answer));

const glasgow = getCityNetworkingFaqs('glasgow', 3, 3);
assert.strictEqual(
  glasgow[0].question,
  'Where can I find business networking events in Glasgow?'
);

const bristol = getCityNetworkingFaqs('bristol', 3, 3);
assert.strictEqual(
  bristol[0].question,
  'Where can I find business networking events in Bristol?'
);

console.log('ok — ' + NETWORKING_CITY_SLUGS.length + ' city FAQ sets are unique');
