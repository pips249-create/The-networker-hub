/**
 * Pip's Activity is Catherine-only and lists her own CRM and event actions.
 */
const assert = require('assert');
const { canSeePipsActivity, buildPipActivityReport } = require('../api/_lib/pip-activity');

assert.strictEqual(canSeePipsActivity('catherine@thenetworkeruk.com'), true);
assert.strictEqual(canSeePipsActivity('pips249@gmail.com'), true);
assert.strictEqual(canSeePipsActivity('hancher249@gmail.com'), true);
assert.strictEqual(canSeePipsActivity('jamie@thenetworkeruk.com'), false);
assert.strictEqual(canSeePipsActivity('rosie@thenetworkeruk.com'), false);

const report = buildPipActivityReport({
  activityRows: [
    {
      created_at: '2026-10-02T09:00:00.000Z',
      actor_email: 'pips249@gmail.com',
      entity_id: 'ev-1',
      organiser_id: 'org-1',
      action: 'event_created',
      summary: 'Added series date: Breakfast (2 Oct 2026)',
    },
    {
      created_at: '2026-10-02T09:00:01.000Z',
      actor_email: 'pips249@gmail.com',
      entity_id: 'ev-1',
      organiser_id: 'org-1',
      action: 'event_created',
      summary: 'duplicate',
    },
    {
      created_at: '2026-10-02T11:00:00.000Z',
      actor_email: 'jamie@thenetworkeruk.com',
      entity_id: 'ev-j',
      organiser_id: 'org-2',
      action: 'event_created',
      summary: 'Added event: Jamie listing',
    },
    {
      created_at: '2026-09-01T11:00:00.000Z',
      actor_email: 'catherine@thenetworkeruk.com',
      entity_id: 'ev-old',
      organiser_id: 'org-9',
      action: 'event_created',
      summary: 'before period',
    },
  ],
  demos: [
    {
      shown_at: '2026-10-02',
      shown_by: 'Catherine',
      organiser_name: 'Delta Network',
      organiser_id: 'org-5',
      notes: 'Referred to Jamie — intro emailed',
      created_by_email: 'pips249@gmail.com',
    },
    {
      shown_at: '2026-10-03',
      shown_by: 'Catherine',
      organiser_name: 'Alpha Network',
      organiser_id: 'org-1',
      notes: 'Called — left voicemail',
      created_by_email: 'catherine@thenetworkeruk.com',
    },
    {
      shown_at: '2026-10-04',
      shown_by: 'Catherine',
      organiser_name: 'Beta',
      notes: 'Meeting — Thursday',
      created_by_email: 'catherine@thenetworkeruk.com',
    },
    {
      shown_at: '2026-10-04',
      shown_by: 'Jamie',
      organiser_name: 'Gamma',
      notes: 'Meeting',
      created_by_email: 'jamie@thenetworkeruk.com',
    },
  ],
  listedEvents: [
    {
      id: 'ev-listed',
      title: 'County lunch',
      organiser_id: 'org-1',
      created_at: '2026-10-05T10:00:00.000Z',
    },
  ],
});

assert.strictEqual(report.counts.events, 2);
assert.strictEqual(report.counts.referrals, 1);
assert.strictEqual(report.counts.meetings, 1);
assert.strictEqual(report.counts.outreach, 1);
assert.ok(report.activity.some((item) => item.kind === 'event' && item.summary.indexOf('Breakfast') !== -1));
assert.ok(report.activity.some((item) => item.kind === 'event' && item.summary.indexOf('County lunch') !== -1));
assert.ok(
  report.activity.some(
    (item) => item.kind === 'referral' && item.summary.indexOf('Delta') !== -1 && item.summary.indexOf('intro emailed') !== -1
  )
);
assert.ok(!report.activity.some((item) => item.summary.indexOf('Jamie listing') !== -1));
assert.ok(!report.activity.some((item) => item.summary.indexOf('Gamma') !== -1));
assert.ok(!report.activity.some((item) => item.summary.indexOf('before period') !== -1));

console.log('test-pip-activity: ok');
