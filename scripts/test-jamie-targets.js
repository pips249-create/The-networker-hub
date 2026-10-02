/**
 * Jamie's targets: visibility, meeting notes, claim credit, and event counts.
 */
const assert = require('assert');
const {
  canSeeJamieTargets,
  canReferMeetingToJamie,
  isBookedMeetingNotes,
  isReferredMeetingNotes,
  lastStaffBeforeClaim,
  buildJamieTargetsReport,
  periodMeta,
} = require('../api/_lib/jamie-targets');

assert.strictEqual(canSeeJamieTargets('catherine@thenetworkeruk.com'), true);
assert.strictEqual(canSeeJamieTargets('pips249@gmail.com'), true);
assert.strictEqual(canSeeJamieTargets('hancher249@gmail.com'), true);
assert.strictEqual(canSeeJamieTargets('jamie@thenetworkeruk.com'), true);
assert.strictEqual(canSeeJamieTargets('jamie.trickett01@gmail.com'), true);
assert.strictEqual(canSeeJamieTargets('rosie@thenetworkeruk.com'), false);
assert.strictEqual(canSeeJamieTargets('someone@example.com'), false);
assert.strictEqual(canReferMeetingToJamie('catherine@thenetworkeruk.com'), true);
assert.strictEqual(canReferMeetingToJamie('pips249@gmail.com'), true);
assert.strictEqual(canReferMeetingToJamie('jamie@thenetworkeruk.com'), false);
assert.strictEqual(isReferredMeetingNotes('Referred to Jamie'), true);
assert.strictEqual(isReferredMeetingNotes('Referred to Jamie — intro emailed'), true);
assert.strictEqual(isReferredMeetingNotes('Meeting'), false);
assert.strictEqual(isBookedMeetingNotes('Referred to Jamie'), false);

assert.strictEqual(isBookedMeetingNotes('Meeting'), true);
assert.strictEqual(isBookedMeetingNotes('Meeting — Thursday 10am'), true);
assert.strictEqual(isBookedMeetingNotes('Called'), false);
assert.strictEqual(isBookedMeetingNotes('Meeting — Tailored pitch deck: https://example.com'), false);
assert.strictEqual(
  isBookedMeetingNotes('2026-10-02: Listed an event — “Breakfast”'),
  false
);
assert.strictEqual(isBookedMeetingNotes('Called\nMeeting — booked for Friday'), true);

const claimAt = '2026-10-05T10:00:00.000Z';
const jamieLast = lastStaffBeforeClaim(
  [
    { organiserId: 'org-1', staff: 'Catherine', at: '2026-09-01T12:00:00.000Z' },
    { organiserId: 'org-1', staff: 'Jamie', at: '2026-10-04T12:00:00.000Z' },
  ],
  'org-1',
  claimAt
);
assert.strictEqual(jamieLast && jamieLast.staff, 'Jamie');

const catherineLast = lastStaffBeforeClaim(
  [
    { organiserId: 'org-1', staff: 'Jamie', at: '2026-09-01T12:00:00.000Z' },
    { organiserId: 'org-1', staff: 'Catherine', at: '2026-10-04T12:00:00.000Z' },
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
  now: new Date('2026-10-02T12:00:00.000Z'),
  activityRows: [
    {
      created_at: '2026-10-02T09:00:00.000Z',
      actor_email: 'jamie@thenetworkeruk.com',
      entity_id: 'ev-1',
      organiser_id: 'org-1',
      action: 'event_created',
      summary: 'Added series date: Breakfast (2 Oct 2026)',
    },
    {
      created_at: '2026-10-02T09:00:01.000Z',
      actor_email: 'jamie@thenetworkeruk.com',
      entity_id: 'ev-2',
      organiser_id: 'org-1',
      action: 'event_created',
      summary: 'Added series date: Breakfast (9 Oct 2026)',
    },
    {
      created_at: '2026-10-02T09:00:02.000Z',
      actor_email: 'jamie@thenetworkeruk.com',
      entity_id: 'ev-2',
      organiser_id: 'org-1',
      action: 'event_created',
      summary: 'duplicate',
    },
    {
      created_at: '2026-09-30T09:00:00.000Z',
      actor_email: 'jamie@thenetworkeruk.com',
      entity_id: 'ev-old',
      organiser_id: 'org-9',
      action: 'event_created',
      summary: 'before period',
    },
    {
      created_at: '2026-10-02T11:00:00.000Z',
      actor_email: 'catherine@thenetworkeruk.com',
      entity_id: 'ev-c',
      organiser_id: 'org-3',
      action: 'event_created',
      summary: 'Added event: Catherine listing',
    },
  ],
  demos: [
    {
      shown_at: '2026-10-02',
      shown_by: 'Jamie',
      organiser_name: 'Alpha Network',
      organiser_id: 'org-1',
      notes: 'Meeting — Thursday',
      created_by_email: 'jamie@thenetworkeruk.com',
    },
    {
      shown_at: '2026-10-03',
      shown_by: 'Jamie',
      organiser_name: 'Beta',
      organiser_id: 'org-2',
      notes: 'Meeting — Tailored pitch deck: https://example.com/deck',
      created_by_email: 'jamie@thenetworkeruk.com',
    },
    {
      shown_at: '2026-10-01',
      shown_by: 'Rosie',
      organiser_name: 'Gamma',
      organiser_id: 'org-4',
      notes: 'Meeting',
      created_by_email: 'rosie@thenetworkeruk.com',
    },
    {
      shown_at: '2026-10-02',
      shown_by: 'Catherine',
      organiser_name: 'Delta Network',
      organiser_id: 'org-5',
      notes: 'Referred to Jamie — intro emailed',
      created_by_email: 'catherine@thenetworkeruk.com',
    },
  ],
  organisers: [
    { id: 'org-1', name: 'Alpha Network', ownership_claimed_at: '2026-10-05T10:00:00.000Z' },
    { id: 'org-4', name: 'Gamma', ownership_claimed_at: '2026-10-06T10:00:00.000Z' },
  ],
});

assert.strictEqual(report.metrics.events.actual, 2);
assert.strictEqual(report.metrics.events.target, 275);
assert.strictEqual(report.metrics.meetings.actual, 1.25);
assert.strictEqual(report.metrics.meetings.booked, 1);
assert.strictEqual(report.metrics.meetings.referred, 1);
assert.strictEqual(report.metrics.meetings.referredPoints, 0.25);
assert.strictEqual(report.metrics.meetings.target, 4);
assert.ok(report.activity.some((item) => item.kind === 'referral' && item.summary.indexOf('Delta') !== -1));
assert.strictEqual(report.metrics.claimedPages.actual, 1);
assert.strictEqual(report.metrics.claimedPages.target, 25);
assert.strictEqual(report.period.daysElapsed, 2);
assert.strictEqual(report.period.daysTotal, 33);
assert.ok(report.activity.some((item) => item.kind === 'event' && item.summary.indexOf('series') !== -1));
assert.ok(report.activity.some((item) => item.kind === 'claim' && item.summary.indexOf('Alpha') !== -1));
assert.ok(!report.activity.some((item) => item.summary.indexOf('Gamma') !== -1));

const meta = periodMeta(new Date('2026-11-03T12:00:00.000Z'));
assert.strictEqual(meta.daysElapsed, 33);
assert.strictEqual(meta.daysRemaining, 0);

console.log('test-jamie-targets: ok');
