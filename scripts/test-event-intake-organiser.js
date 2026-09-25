#!/usr/bin/env node
/**
 * Event intake must be attached to an organiser page the submitter owns.
 * Usage: node scripts/test-event-intake-organiser.js
 */
const {
  validateIntake,
  normalizeIntakeInput,
  pickOwnedOrganiser,
  isOrganiserId,
} = require('../api/_lib/event-intake');

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL:', label);
    process.exitCode = 1;
    return false;
  }
  console.log('ok:', label);
  return true;
}

const pageId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';

function base(extra) {
  return Object.assign(
    {
      name: 'Shannon Davies',
      email: 'shannon@example.com',
      group: 'Zellig',
      organiserId: pageId,
      title: 'Rise and Shine Networking Morning',
      dates: 'Tue, 6 Oct 2026',
      format: 'In person',
      city: 'Birmingham',
    },
    extra || {}
  );
}

const missing = validateIntake(normalizeIntakeInput(base({ organiserId: '' })));
assert('missing organiser page is rejected', missing.ok === false && missing.error === 'missing_organiser_page');

const badId = validateIntake(normalizeIntakeInput(base({ organiserId: 'not-a-page' })));
assert('non-uuid organiser id is rejected', badId.ok === false && badId.error === 'missing_organiser_page');

const ok = validateIntake(normalizeIntakeInput(base()));
assert('owned organiser page id is accepted', ok.ok === true);

const snake = normalizeIntakeInput(base({ organiserId: undefined, organiser_id: pageId }));
assert('snake_case organiser id is read', snake.organiserId === pageId);
assert('snake_case id validates', validateIntake(snake).ok === true);

const honeypot = validateIntake(normalizeIntakeInput(base({ organiserId: '', website: 'https://spam.example' })));
assert('honeypot still short-circuits', honeypot.ok === true && honeypot.honeypot === true);

const groups = [
  { id: pageId, name: 'Zellig' },
  { id: otherId, name: 'Other group' },
];
assert('picks the page they own', pickOwnedOrganiser(groups, pageId.toUpperCase()).name === 'Zellig');
assert('rejects a page they do not own', pickOwnedOrganiser(groups, '33333333-3333-4333-8333-333333333333') === null);
assert('rejects a blank page', pickOwnedOrganiser(groups, '') === null);
assert('uuid check accepts organiser ids', isOrganiserId(pageId));
assert('uuid check rejects names', isOrganiserId('Zellig') === false);

if (process.exitCode) {
  console.error('event intake organiser checks failed');
} else {
  console.log('event intake organiser checks passed');
}
