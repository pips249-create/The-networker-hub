#!/usr/bin/env node
const assert = require('assert');

// Mirror helpers from api/_lib/routes/organiser-events.js (not exported from handler).
function normalizeOccurrences(body) {
  if (Array.isArray(body.occurrences) && body.occurrences.length) {
    return body.occurrences
      .map((o) => ({
        date: o.date || o.start || o.dateTime || '',
        endDate: o.endDate || o.end || '',
      }))
      .filter((o) => o.date);
  }
  const dates = Array.isArray(body.dates) ? body.dates.filter(Boolean) : [];
  if (dates.length) {
    return dates.map((date) => ({ date, endDate: body.endDate || '' }));
  }
  const single = body.date || body.dateTime || '';
  return single ? [{ date: single, endDate: body.endDate || '' }] : [];
}

function occurrencesFromExistingEvent(existing) {
  if (!existing) return [];
  const date = String(existing.date || existing.startsAt || existing.starts_at || '').trim();
  if (!date) return [];
  const endDate = String(existing.endDate || existing.endsAt || existing.ends_at || '').trim();
  return [{ date, endDate }];
}

const patchBody = { listingStatus: 'published', checkoutMode: 'external_connected' };
let occ = normalizeOccurrences(patchBody);
assert.strictEqual(occ.length, 0);
occ = occurrencesFromExistingEvent({ date: '2026-10-01T18:00:00.000Z', endDate: '2026-10-01T21:00:00.000Z' });
assert.strictEqual(occ.length, 1);
assert.strictEqual(occ[0].date, '2026-10-01T18:00:00.000Z');

console.log('test-organiser-events-connected-publish: ok');
