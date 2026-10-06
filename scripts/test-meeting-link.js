#!/usr/bin/env node
/**
 * Unit tests for meeting-link normalisation (email join CTAs / event save).
 */
const assert = require('assert');
const {
  normalizeMeetingLink,
  meetingLinkHref,
  zoomDeepLinkToHttps,
} = require('../api/_lib/meeting-link');
const { buildMeetingLinkRow } = require('../api/_lib/booking-email-sections');

function ok(name) {
  console.log('ok —', name);
}

assert.strictEqual(
  normalizeMeetingLink('https://us02web.zoom.us/j/12345678901?pwd=abc'),
  'https://us02web.zoom.us/j/12345678901?pwd=abc'
);
ok('keeps valid Zoom https URL');

assert.strictEqual(
  normalizeMeetingLink('zoom.us/j/12345678901'),
  'https://zoom.us/j/12345678901'
);
ok('adds https:// when protocol is missing');

const singleSlash = normalizeMeetingLink('https:/us02web.zoom.us/j/12345678901');
assert.ok(
  /^https:\/\/us02web\.zoom\.us\/j\/12345678901\/?$/.test(singleSlash),
  'single-slash protocol typo: ' + singleSlash
);
ok('repairs https:/host typos');

assert.strictEqual(
  normalizeMeetingLink('www.zoom.us/j/12345678901?pwd=x'),
  'https://www.zoom.us/j/12345678901?pwd=x'
);
ok('adds https:// for www.zoom.us bare host');

const pasted = normalizeMeetingLink(
  'Join Zoom Meeting\nhttps://us02web.zoom.us/j/12345678901?pwd=secret\nMeeting ID: 123 4567 8901'
);
assert.strictEqual(pasted, 'https://us02web.zoom.us/j/12345678901?pwd=secret');
ok('extracts URL from pasted Zoom invite text');

const deep = zoomDeepLinkToHttps(
  'zoommtg://zoom.us/join?action=join&confno=12345678901&pwd=AbCdEf'
);
assert.strictEqual(deep, 'https://zoom.us/j/12345678901?pwd=AbCdEf');
assert.strictEqual(
  normalizeMeetingLink('zoommtg://zoom.us/join?action=join&confno=12345678901&pwd=AbCdEf'),
  'https://zoom.us/j/12345678901?pwd=AbCdEf'
);
ok('converts zoommtg:// deep links to https join URLs');

assert.strictEqual(normalizeMeetingLink('javascript:alert(1)'), '');
assert.strictEqual(normalizeMeetingLink('not a link'), '');
assert.strictEqual(normalizeMeetingLink(''), '');
ok('rejects non-http join targets');

const href = meetingLinkHref('zoom.us/j/99988877766');
assert.strictEqual(href, 'https://zoom.us/j/99988877766');
const row = buildMeetingLinkRow('zoom.us/j/99988877766', true);
assert.ok(row.includes('href="https://zoom.us/j/99988877766"'), row);
assert.ok(!row.includes('href="zoom.us'), 'relative href must not appear in reminder CTA');
ok('booking reminder CTA uses absolute https href');

assert.strictEqual(buildMeetingLinkRow('not-a-url', true), '');
assert.strictEqual(meetingLinkHref(''), '');
ok('omits join CTA when link cannot be normalised');

console.log('\nAll meeting-link checks passed.');
