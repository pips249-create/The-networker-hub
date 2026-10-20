#!/usr/bin/env node
/**
 * Smoke checks for International SEO / AEO surfaces.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'international');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function extractJsonLd(html) {
  const match = html.match(
    /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/
  );
  assert.ok(match, 'expected JSON-LD block');
  return JSON.parse(match[1]);
}

const home = read('index.html');
const ireland = read('ireland/index.html');
const usa = read('united-states/index.html');
const llms = read('llms.txt');
const agents = read('agents.txt');
const sitemap = read('sitemap.xml');

assert.ok(
  home.includes('Business networking events by country'),
  'home title should mention events'
);
assert.ok(home.includes('max-snippet:-1'), 'home robots should allow rich snippets');
assert.ok(home.includes('Is The Networker live in Canada or Mexico?'));
assert.ok(home.includes('How are countries grouped on the map?'));

const homeLd = extractJsonLd(home);
assert.ok(Array.isArray(homeLd['@graph']), 'home JSON-LD graph');
const faq = homeLd['@graph'].find(function (n) {
  return n['@type'] === 'FAQPage';
});
assert.ok(faq && Array.isArray(faq.mainEntity));
const faqNames = faq.mainEntity.map(function (q) {
  return q.name;
});
assert.ok(faqNames.includes('Is The Networker live in Canada or Mexico?'));
assert.ok(faqNames.includes('How are countries grouped on the map?'));
assert.ok(
  homeLd['@graph'].some(function (n) {
    return n['@type'] === 'WebPage' && n.speakable;
  }),
  'home WebPage should be speakable'
);

assert.ok(llms.includes('Canada — **map-only**'));
assert.ok(llms.includes('Mexico — **map-only**'));
assert.ok(llms.includes('How are countries grouped on the map?'));
assert.ok(agents.includes('Do not bundle Canada or Mexico'));
assert.ok(agents.includes('Benelux'));

assert.ok(sitemap.includes('2026-10-20'));
assert.ok(sitemap.includes('/llms.txt'));
assert.ok(sitemap.includes('/agents.txt'));

const irelandLd = extractJsonLd(ireland);
assert.ok(
  irelandLd['@graph'].some(function (n) {
    return n['@type'] === 'FAQPage';
  })
);
assert.ok(ireland.includes('browse networking events while Ireland is building'));

const usaLd = extractJsonLd(usa);
assert.ok(
  usaLd['@graph'].some(function (n) {
    return n['@type'] === 'FAQPage';
  })
);
assert.ok(usa.includes('Canada and Mexico'));
assert.ok(usa.includes('Are Canada and Mexico part of the US building market?'));

console.log('test-intl-seo-aeo: ok');
