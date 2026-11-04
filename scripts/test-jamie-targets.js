/**
 * Jamie's targets: visibility, meeting notes, claim credit, and event counts.
 */
const assert = require('assert');
const {
  canSeeJamieTargets,
  isBookedMeetingNotes,
  lastStaffBeforeClaim,
  creditListedEvents,
  buildJamieTargetsReport,
  periodMeta,
  CLOSED_PERIODS,
  TARGETS,
} = require('../api/_lib/jamie-targets');

assert.strictEqual(canSeeJamieTargets('catherine@thenetworkeruk.com'), true);
assert.strictEqual(canSeeJamieTargets('pips249@gmail.com'), true);
assert.strictEqual(canSeeJamieTargets('hancher249@gmail.com'), true);
assert.strictEqual(canSeeJamieTargets('jamie@thenetworkeruk.com'), true);
assert.strictEqual(canSeeJamieTargets('jamie.trickett01@gmail.com'), true);
assert.strictEqual(canSeeJamieTargets('rosie@thenetworkeruk.com'), false);
assert.strictEqual(canSeeJamieTargets('someone@example.com'), false);

assert.strictEqual(isBookedMeetingNotes('Meeting'), true);
assert.strictEqual(isBookedMeetingNotes('Meeting — Thursday 10am'), true);
assert.strictEqual(isBookedMeetingNotes('Called'), false);
assert.strictEqual(isBookedMeetingNotes('Meeting — Tailored pitch deck: https://example.com'), false);
assert.strictEqual(
  isBookedMeetingNotes('2026-11-02: Listed an event — “Breakfast”'),
  false
);
assert.strictEqual(isBookedMeetingNotes('Called\nMeeting — booked for Friday'), true);

assert.strictEqual(TARGETS.meetings, 4);
assert.strictEqual(TARGETS.claimedPages, 25);
assert.strictEqual(TARGETS.events, 275);
assert.ok(CLOSED_PERIODS.length >= 1);
assert.strictEqual(CLOSED_PERIODS[0].results.meetings, 3);
assert.strictEqual(CLOSED_PERIODS[0].results.claimedPages, 5);
assert.strictEqual(CLOSED_PERIODS[0].results.events, 291);

const claimAt = '2026-11-05T10:00:00.000Z';
const jamieLast = lastStaffBeforeClaim(
  [
    { organiserId: 'org-1', staff: 'Catherine', at: '2026-10-01T12:00:00.000Z' },
    { organiserId: 'org-1', staff: 'Jamie', at: '2026-11-04T12:00:00.000Z' },
  ],
  'org-1',
  claimAt
);
assert.strictEqual(jamieLast && jamieLast.staff, 'Jamie');

const catherineLast = lastStaffBeforeClaim(
  [
    { organiserId: 'org-1', staff: 'Jamie', at: '2026-10-01T12:00:00.000Z' },
    { organiserId: 'org-1', staff: 'Catherine', at: '2026-11-04T12:00:00.000Z' },
  ],
  'org-1',
  claimAt
);
assert.strictEqual(catherineLast && catherineLast.staff, 'Catherine');

const stale = lastStaffBeforeClaim(
  [{ organiserId: 'org-1', staff: 'Jamie', at: '2026-01-01T12:00:00.000Z' }],
  'org-1',
  claimAt
);
assert.strictEqual(stale, null);

const report = buildJamieTargetsReport({
  now: new Date('2026-11-02T12:00:00.000Z'),
  activityRows: [
    {
      created_at: '2026-11-02T09:00:00.000Z',
      actor_email: 'jamie@thenetworkeruk.com',
      entity_id: 'ev-1',
      organiser_id: 'org-1',
      action: 'event_created',
      summary: 'Added series date: Breakfast (2 Nov 2026)',
    },
    {
      created_at: '2026-11-02T09:00:01.000Z',
      actor_email: 'jamie@thenetworkeruk.com',
      entity_id: 'ev-2',
      organiser_id: 'org-1',
      action: 'event_created',
      summary: 'Added series date: Breakfast (9 Nov 2026)',
    },
    {
      created_at: '2026-11-02T09:00:02.000Z',
      actor_email: 'jamie@thenetworkeruk.com',
      entity_id: 'ev-2',
      organiser_id: 'org-1',
      action: 'event_created',
      summary: 'duplicate',
    },
    {
      created_at: '2026-10-30T09:00:00.000Z',
      actor_email: 'jamie@thenetworkeruk.com',
      entity_id: 'ev-old',
      organiser_id: 'org-9',
      action: 'event_created',
      summary: 'before period',
    },
    {
      created_at: '2026-11-02T11:00:00.000Z',
      actor_email: 'catherine@thenetworkeruk.com',
      entity_id: 'ev-c',
      organiser_id: 'org-3',
      action: 'event_created',
      summary: 'Added event: Catherine listing',
    },
  ],
  demos: [
    {
      shown_at: '2026-11-02',
      shown_by: 'Jamie',
      organiser_name: 'Alpha Network',
      organiser_id: 'org-1',
      notes: 'Meeting — Thursday',
      created_by_email: 'jamie@thenetworkeruk.com',
    },
    {
      shown_at: '2026-11-03',
      shown_by: 'Jamie',
      organiser_name: 'Beta',
      organiser_id: 'org-2',
      notes: 'Meeting — Tailored pitch deck: https://example.com/deck',
      created_by_email: 'jamie@thenetworkeruk.com',
    },
    {
      shown_at: '2026-11-01',
      shown_by: 'Rosie',
      organiser_name: 'Gamma',
      organiser_id: 'org-4',
      notes: 'Meeting',
      created_by_email: 'rosie@thenetworkeruk.com',
    },
  ],
  organisers: [
    { id: 'org-1', name: 'Alpha Network', ownership_claimed_at: '2026-11-05T10:00:00.000Z' },
    { id: 'org-4', name: 'Gamma', ownership_claimed_at: '2026-11-06T10:00:00.000Z' },
  ],
});

assert.strictEqual(report.metrics.events.actual, 2);
assert.strictEqual(report.metrics.events.target, 275);
assert.strictEqual(report.metrics.meetings.actual, 1);
assert.strictEqual(report.metrics.meetings.target, 4);
assert.strictEqual(report.metrics.claimedPages.actual, 1);
assert.strictEqual(report.metrics.claimedPages.target, 25);
assert.strictEqual(report.period.daysElapsed, 2);
assert.strictEqual(report.period.daysTotal, 30);
assert.strictEqual(report.period.label, '1 – 30 November 2026');
assert.ok(report.previous);
assert.strictEqual(report.previous.metrics.meetings.actual, 3);
assert.strictEqual(report.previous.metrics.claimedPages.actual, 5);
assert.strictEqual(report.previous.metrics.events.actual, 291);
assert.strictEqual(report.previous.metrics.events.target, 275);
assert.ok(report.previous.metrics.events.complete);
assert.ok(report.activity.some((item) => item.kind === 'event' && item.summary.indexOf('series') !== -1));
assert.ok(report.activity.some((item) => item.kind === 'claim' && item.summary.indexOf('Alpha') !== -1));
assert.ok(!report.activity.some((item) => item.summary.indexOf('Gamma') !== -1));

const meta = periodMeta(new Date('2026-12-01T12:00:00.000Z'));
assert.strictEqual(meta.daysElapsed, 30);
assert.strictEqual(meta.daysRemaining, 0);

const earlyNov = periodMeta(new Date('2026-11-04T12:00:00.000Z'));
assert.strictEqual(earlyNov.daysElapsed, 4);
assert.strictEqual(earlyNov.daysRemaining, 26);

const listedDemos = [
  {
    shown_at: '2026-11-03',
    shown_by: 'Jamie',
    organiser_name: 'Delta',
    organiser_id: 'org-d',
    notes: '2026-11-03: Listed an event — “Thursday breakfast”',
    created_by_email: 'jamie.trickett01@gmail.com',
  },
];
const listedEvents = [
  {
    id: 'e1',
    title: 'Thursday breakfast',
    organiser_id: 'org-d',
    created_at: '2026-11-03T10:00:00.000Z',
    starts_at: '2026-11-09T09:00:00.000Z',
  },
  {
    id: 'e2',
    title: 'Thursday breakfast',
    organiser_id: 'org-d',
    created_at: '2026-11-03T10:00:01.000Z',
    starts_at: '2026-11-16T09:00:00.000Z',
  },
  {
    id: 'e-other',
    title: 'Someone else',
    organiser_id: 'org-d',
    created_at: '2026-11-03T10:00:02.000Z',
    starts_at: '2026-11-16T09:00:00.000Z',
  },
];
const credited = creditListedEvents(listedDemos, listedEvents, 'Jamie');
assert.deepStrictEqual(
  credited.map((row) => row.id),
  ['e1', 'e2']
);

const missed = creditListedEvents(
  [
    {
      shown_by: 'Jamie',
      organiser_name: 'Echo',
      organiser_id: 'org-e',
      notes: '2026-11-04: Listed an event — “Lunch”',
    },
  ],
  [],
  'Jamie'
);
assert.strictEqual(missed.length, 1);
assert.ok(String(missed[0].id).indexOf('listed:') === 0);

const fromListings = buildJamieTargetsReport({
  now: new Date('2026-11-06T12:00:00.000Z'),
  activityRows: [],
  demos: listedDemos,
  organisers: [],
  listedEvents: credited,
});
assert.strictEqual(fromListings.metrics.events.actual, 2);
assert.ok(fromListings.activity.filter((item) => item.kind === 'event').length === 2);

const withEmail = buildJamieTargetsReport({
  now: new Date('2026-11-06T12:00:00.000Z'),
  activityRows: [],
  demos: [
    {
      shown_at: '2026-11-06',
      shown_by: 'Jamie',
      organiser_name: 'Colony Networking',
      organiser_id: 'org-c',
      notes: 'Meeting — Thursday\n2026-11-06: Emailed',
      created_by_email: 'jamie@thenetworkeruk.com',
    },
  ],
  organisers: [],
});
assert.strictEqual(withEmail.metrics.meetings.actual, 1);
assert.strictEqual(withEmail.activity.filter((item) => item.kind === 'outreach').length, 1);
assert.ok(withEmail.activity.some((item) => item.kind === 'outreach' && item.summary.indexOf('Emailed') !== -1));

console.log('test-jamie-targets: ok');
