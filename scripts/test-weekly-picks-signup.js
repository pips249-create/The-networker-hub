#!/usr/bin/env node
const assert = require('assert');
const {
  normalizeSignupEmail,
  isValidSignupEmail,
} = require('../api/_lib/weekly-picks-signup');

assert.strictEqual(normalizeSignupEmail('  Ada@Example.com '), 'ada@example.com');
assert.ok(isValidSignupEmail('ada@example.com'));
assert.ok(!isValidSignupEmail('not-an-email'));
assert.ok(!isValidSignupEmail(''));

const fs = require('fs');
const path = require('path');
const eventsHtml = fs.readFileSync(path.join(__dirname, '../events/index.html'), 'utf8');
assert.doesNotMatch(eventsHtml, /id="weekly-picks-rail"/);
assert.doesNotMatch(eventsHtml, /weekly-picks-rail\.js\?v=/);

const eventHtml = fs.readFileSync(path.join(__dirname, '../events/event.html'), 'utf8');
assert.match(eventHtml, /id="weekly-picks-rail"/);
assert.match(eventHtml, /weekly-picks-rail--detail/);
assert.match(eventHtml, /weekly-picks-rail\.js\?v=/);
assert.match(eventHtml, /weekly-picks-rail\.css\?v=/);
assert.match(eventHtml, /Weekly picks · Fridays/);

const railJs = fs.readFileSync(path.join(__dirname, '../js/weekly-picks-rail.js'), 'utf8');
assert.match(railJs, /hubWeeklyPicksContext/);
assert.match(railJs, /source:\s*'event_detail'/);
assert.doesNotMatch(railJs, /INSERT_INDEX/);

const detailJs = fs.readFileSync(path.join(__dirname, '../js/event-detail.js'), 'utf8');
assert.match(detailJs, /syncWeeklyPicksContext/);

const authJs = fs.readFileSync(path.join(__dirname, '../api/auth.js'), 'utf8');
assert.match(authJs, /weekly-picks-signup/);

console.log('ok — weekly picks signup on event detail');
