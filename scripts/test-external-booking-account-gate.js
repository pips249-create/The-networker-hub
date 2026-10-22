#!/usr/bin/env node
/**
 * Smoke: Connected events require an account before leaving for the organiser site.
 * Link Out opens the organiser URL directly and must not promise ticket sync.
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
  'buy CTA must call requireAccountForExternalBooking'
);
assert.ok(
  detailJs.includes('eventHasExternalRegistrationSync'),
  'must distinguish Connected (sync) vs Link Out (no sync)'
);
assert.ok(
  detailJs.includes('if (!eventHasExternalRegistrationSync(ev)) return true'),
  'Link Out must skip the account gate and open the organiser site'
);
assert.ok(
  detailJs.includes('preferRegister: true'),
  'Connected gate should push Create free account ahead of Sign in'
);
assert.ok(
  detailJs.includes("intent.action === 'external_book'"),
  'resume after join/sign-in must continue to organiser site'
);
assert.ok(
  detailJs.includes("'Create free account to book'"),
  'Connected signed-out CTA must invite account creation'
);
assert.ok(
  detailJs.includes('externalBookingBuyLabel'),
  'buy label must branch on Connected vs Link Out'
);
assert.ok(
  detailJs.includes("when their booking syncs, your ticket shows in My account"),
  'Connected gate copy may explain webhook sync'
);
assert.ok(
  detailJs.includes('// Connected only — Link Out never syncs tickets into My account.'),
  'sidebar sync nudge must be Connected-only'
);
assert.ok(
  eventHtml.includes('Create a free Networker UK account first'),
  'Connected sidebar nudge must explain why to join before booking'
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
