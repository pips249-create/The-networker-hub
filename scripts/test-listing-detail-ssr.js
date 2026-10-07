#!/usr/bin/env node
/**
 * Unit checks for crawlable event/organiser SSR payloads + HTML injectors.
 * Run: node scripts/test-listing-detail-ssr.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  buildEventDetailSsr,
  buildOrganiserDetailSsr,
  injectEventDetailContent,
  injectOrganiserDetailContent,
} = require('../api/_lib/listing-detail-ssr');

const ORIGIN = 'https://www.thenetworkeruk.com';

const eventSsr = buildEventDetailSsr(
  {
    title: 'Thursday Breakfast',
    slug: 'thursday-breakfast',
    description: 'Weekly networking breakfast in Manchester for local business owners.',
    organiser: 'BNI Manchester',
    organiserSlug: 'bni-manchester',
    city: 'Manchester',
    venue: 'Town Hall',
    venueAddress: 'Albert Square, Manchester',
    date: 'Thursday, 8 October 2026',
    time: '07:30 – 09:00',
    price: '£15.00',
    priceKey: 'paid',
    category: 'Networking',
    format: 'In person',
    isEventPast: false,
  },
  ORIGIN
);

assert.strictEqual(eventSsr.title, 'Thursday Breakfast');
assert.strictEqual(eventSsr.hostUrl, ORIGIN + '/organisers/bni-manchester');
assert.ok(eventSsr.about.includes('Weekly networking'));
assert.strictEqual(eventSsr.ended, false);
console.log('ok — event detail SSR payload');

const pastSsr = buildEventDetailSsr(
  {
    title: 'Past Meetup',
    slug: 'past-meetup',
    description: 'Already happened.',
    isEventPast: true,
    city: 'Leeds',
  },
  ORIGIN
);
assert.strictEqual(pastSsr.ended, true);
assert.ok(pastSsr.endedTitle);
console.log('ok — past event SSR marks ended');

const orgSsr = buildOrganiserDetailSsr(
  {
    name: '121 Business Links',
    slug: '121-business-links',
    description: 'Business networking across the North West.',
    city: 'Manchester',
    website: 'https://example.com',
  },
  ORIGIN,
  [{ title: 'Friday Lunch', slug: 'friday-lunch', date: 'Fri 10 Oct', city: 'Manchester' }]
);
assert.strictEqual(orgSsr.name, '121 Business Links');
assert.ok(orgSsr.upcomingHtml.includes('/events/friday-lunch'));
assert.ok(orgSsr.upcomingHtml.includes('Friday Lunch'));
console.log('ok — organiser detail SSR payload');

const eventHtml = fs.readFileSync(path.join(__dirname, '../events/event.html'), 'utf8');
const injectedEvent = injectEventDetailContent(eventHtml, {
  description: 'fallback',
  detailSsr: eventSsr,
});
assert.ok(injectedEvent.includes('>Thursday Breakfast</h1>'));
assert.ok(!injectedEvent.includes('>Loading event…</h1>'));
assert.ok(injectedEvent.includes('Weekly networking breakfast'));
assert.ok(injectedEvent.includes('id="hub-ssr-event-facts"'));
assert.ok(injectedEvent.includes('BNI Manchester'));
assert.ok(injectedEvent.includes('/organisers/bni-manchester'));
console.log('ok — event.html injector fills title/about/facts');

const orgHtml = fs.readFileSync(path.join(__dirname, '../events/organiser.html'), 'utf8');
const injectedOrg = injectOrganiserDetailContent(orgHtml, {
  description: 'fallback desc',
  detailSsr: orgSsr,
});
assert.ok(injectedOrg.includes('id="hub-ssr-organiser"'));
assert.ok(injectedOrg.includes('<h1>121 Business Links</h1>'));
assert.ok(injectedOrg.includes('/events/friday-lunch'));
assert.ok(/id=["']org-profile-content["'](?![^>]*\bhidden\b)/i.test(injectedOrg));
console.log('ok — organiser.html injector adds crawlable block');

const mw = fs.readFileSync(path.join(__dirname, '../middleware.js'), 'utf8');
assert.ok(mw.includes('function injectEventDetailContent'));
assert.ok(mw.includes('function injectOrganiserDetailContent'));
assert.ok(mw.includes("type === 'event'"));
assert.ok(mw.includes("type === 'organiser'"));
assert.ok(mw.includes('Always noindex'));
console.log('ok — middleware wires event/organiser SSR injectors');

console.log('All listing-detail-ssr checks passed.');
