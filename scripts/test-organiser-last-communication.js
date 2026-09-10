#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  parseLastContactFilter,
  parseLastContactSort,
  needsLastContactPass,
  contactMs,
  demoToContact,
  pickNewerContact,
  matchesLastContactFilter,
  sortByLastContact,
  attachLastCommunication,
  resolveLastCommunication,
  parseManualTouchNotes,
} = require('../api/_lib/organiser-last-communication');

assert.strictEqual(parseLastContactFilter('never'), 'never');
assert.strictEqual(parseLastContactFilter('stale-30'), 'stale_30');
assert.strictEqual(parseLastContactFilter('nope'), '');
assert.strictEqual(parseLastContactSort('last_contact'), 'last_contact_desc');
assert.strictEqual(parseLastContactSort('last_contact_asc'), 'last_contact_asc');
assert.strictEqual(needsLastContactPass('never', 'updated'), true);
assert.strictEqual(needsLastContactPass('', 'last_contact_asc'), true);
assert.strictEqual(needsLastContactPass('', 'updated'), false);

const manual = demoToContact({
  notes: 'Emailed',
  shown_at: '2026-09-01',
  shown_by: 'Catherine',
  source: 'manual',
});
assert.strictEqual(manual.kind, 'manual');
assert.strictEqual(manual.label, 'Emailed');

const manualWithNote = demoToContact({
  notes: 'Attempted call — left voicemail',
  shown_at: '2026-09-02',
  shown_by: 'Catherine',
  source: 'manual',
});
assert.strictEqual(manualWithNote.kind, 'manual');
assert.strictEqual(manualWithNote.label, 'Attempted call — left voicemail');
assert.strictEqual(parseManualTouchNotes('Called — no answer').touch, 'Called');
assert.strictEqual(parseManualTouchNotes('Called — no answer').message, 'no answer');
assert.strictEqual(parseManualTouchNotes('Random note').touch, '');

const house = demoToContact({
  notes: '2026-08-01: Impersonated workspace',
  shown_at: '2026-08-01',
  shown_by: 'Rosie',
  source: 'impersonate',
});
assert.strictEqual(house.kind, 'house');
assert.strictEqual(house.label, 'Impersonated workspace');

const newer = pickNewerContact(manual, house);
assert.strictEqual(newer.label, 'Emailed');

assert.strictEqual(matchesLastContactFilter(null, 'never'), true);
assert.strictEqual(matchesLastContactFilter(manual, 'never'), false);
assert.strictEqual(matchesLastContactFilter(manual, 'any'), true);

const index = {
  byId: new Map([
    [
      'org-1',
      {
        at: '2026-09-01',
        label: 'Emailed',
        who: 'Catherine',
        kind: 'manual',
      },
    ],
  ]),
  byEmail: new Map(),
  claimById: new Map([['org-2', '2026-07-15T10:00:00.000Z']]),
};

const a = attachLastCommunication({ id: 'org-1', name: 'Alpha', email: 'a@x.com' }, index);
const b = attachLastCommunication({ id: 'org-2', name: 'Beta', email: 'b@x.com' }, index);
const c = attachLastCommunication({ id: 'org-3', name: 'Gamma', email: 'c@x.com' }, index);
assert.strictEqual(a.last_communication_label, 'Emailed');
assert.strictEqual(b.last_communication_kind, 'claim_invite');
assert.strictEqual(c.last_communication_at, null);

const sortedAsc = sortByLastContact([a, b, c], 'last_contact_asc');
assert.deepStrictEqual(
  sortedAsc.map((r) => r.id),
  ['org-3', 'org-2', 'org-1']
);
const sortedDesc = sortByLastContact([a, b, c], 'last_contact_desc');
assert.deepStrictEqual(
  sortedDesc.map((r) => r.id),
  ['org-1', 'org-2', 'org-3']
);

assert.ok(contactMs('2026-09-01') > contactMs('2026-08-01'));
assert.strictEqual(resolveLastCommunication({ id: 'org-1' }, index).who, 'Catherine');

console.log('organiser-last-communication tests passed');
