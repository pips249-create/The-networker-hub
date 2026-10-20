#!/usr/bin/env node
/**
 * Smoke: Linked Out / Connected event pages require an account before leaving for the organiser site.
 * Link Out must not promise ticket sync; Connected may.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const detailJs = fs.readFileSync(path.join(root, 'js/event-detail.js'), 'utf8');
const eventHtml = fs.readFileSync(path.join(root, 'events/event.html'), 'utf8');

assert.ok(
  detailJs.includes("action: 'external_book'"),
  'external book intent must be saved before auth'
);
assert.ok(
  detailJs.includes('requireAccountForExternalBooking'),
  'buy CTA must gate external booking behind an account'
);
assert.ok(
  detailJs.includes('preferRegister: true'),
  'gate should push Create free account ahead of Sign in'
);
assert.ok(
  detailJs.includes("intent.action === 'external_book'"),
  'resume after join/sign-in must continue to organiser site'
);
assert.ok(
  detailJs.includes("'Create free account to book'"),
  'signed-out CTA copy must invite account creation'
);
assert.ok(
  detailJs.includes('eventHasExternalRegistrationSync'),
  'copy must branch on Connected (sync) vs Link Out (no sync)'
);
assert.ok(
  detailJs.includes('tickets for this listing stay on their site'),
  'Link Out gate/nudge must not promise My account ticket sync'
);
assert.ok(
  detailJs.includes('when their booking syncs, your ticket shows in My account'),
  'Connected copy may still explain webhook sync'
);
assert.ok(
  eventHtml.includes('tickets for this listing stay on their site'),
  'default sidebar nudge must be honest for Link Out'
);
assert.ok(
  eventHtml.includes('Already bought? Sign in to check registration'),
  'already-bought path remains for Connected listings'
);
assert.ok(
  !/<button[^>]*>\s*Sign in to check registration\s*<\/button>/.test(eventHtml),
  'old primary "Sign in to check registration" button must be gone'
);

console.log('test-external-booking-account-gate: ok');
