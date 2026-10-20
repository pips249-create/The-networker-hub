#!/usr/bin/env node
/**
 * Admin International leads WHEN column must lead with event date, not created_at.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'admin-app.js'), 'utf8');

assert.ok(src.includes('function formatIntlEventWhen'), 'formatIntlEventWhen helper');
assert.ok(
  src.includes('formatIntlEventWhen(row.startsOn, row.startsAtLocal, row.endsOn)'),
  'events table uses event when helper'
);
assert.ok(src.includes("Added ' +"), 'created_at shown as Added secondary line');

const eventsPaint = src.slice(
  src.indexOf("'<th class=\"py-2 pr-3\">When</th><th class=\"py-2 pr-3\">Event</th>"),
  src.indexOf("'<th class=\"py-2 pr-3\">When</th><th class=\"py-2 pr-3\">Event</th>") + 2500
);
assert.ok(
  eventsPaint.indexOf('formatIntlEventWhen') < eventsPaint.indexOf("Added '"),
  'event date rendered before Added line'
);
assert.ok(
  !/formatIntlLeadDate\(row\.createdAt\)\s*\+\s*[\s\S]{0,80}startsOn/.test(eventsPaint),
  'must not lead WHEN with createdAt then raw startsOn'
);

// Pure formatter behaviour (mirror of admin helper).
function formatIntlEventWhen(startsOn, startsAtLocal, endsOn) {
  var start = String(startsOn || '').trim();
  if (!start) return '—';
  var label = start;
  var parts = start.split('-');
  if (parts.length === 3) {
    label = new Date(
      Number(parts[0]),
      Number(parts[1]) - 1,
      Number(parts[2])
    ).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
  var time = String(startsAtLocal || '').trim();
  var timeMatch = time.match(/^(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    var hours = Number(timeMatch[1]);
    var minutes = Number(timeMatch[2]);
    var suffix = hours >= 12 ? 'pm' : 'am';
    var hour12 = hours % 12;
    if (hour12 === 0) hour12 = 12;
    label += ' · ' + hour12 + ':' + String(minutes).padStart(2, '0') + suffix;
  }
  var end = String(endsOn || '').trim();
  if (end && end !== start) {
    var endParts = end.split('-');
    if (endParts.length === 3) {
      label +=
        ' → ' +
        new Date(
          Number(endParts[0]),
          Number(endParts[1]) - 1,
          Number(endParts[2])
        ).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
    }
  }
  return label;
}

assert.strictEqual(
  formatIntlEventWhen('2026-11-27', '19:00:00', null),
  '27 Nov 2026 · 7:00pm'
);
assert.strictEqual(formatIntlEventWhen('2026-11-19', '', null), '19 Nov 2026');
assert.notStrictEqual(
  formatIntlEventWhen('2026-11-27', '19:00', null).indexOf('20 Oct'),
  0
);

console.log('test-intl-admin-event-when: ok');
