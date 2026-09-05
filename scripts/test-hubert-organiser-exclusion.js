#!/usr/bin/env node
/**
 * Hubert / attendee nurture must skip organiser inboxes (dual-role accounts).
 * Usage: node scripts/test-hubert-organiser-exclusion.js
 */
const {
  isOrganiserAttendee,
  isDueForHubertConcierge,
} = require('../api/_lib/engagement-emails');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('OK:', msg);
}

const keys = {
  organiserUserIds: new Set(['user-org-1']),
  organiserEmails: new Set(['org@example.com']),
};

assert(
  isOrganiserAttendee({ supabase_user_id: 'user-org-1', email: 'member@example.com' }, keys),
  'organiser matched by hub user id'
);
assert(
  isOrganiserAttendee({ supabase_user_id: 'user-attendee', email: 'org@example.com' }, keys),
  'organiser matched by email'
);
assert(
  !isOrganiserAttendee({ supabase_user_id: 'user-attendee', email: 'member@example.com' }, keys),
  'pure attendee is not treated as organiser'
);
assert(
  !isOrganiserAttendee({ email: '' }, keys),
  'empty attendee is not treated as organiser'
);

assert(isDueForHubertConcierge(null), 'never-sent is due');
assert(isDueForHubertConcierge('2000-01-01T00:00:00.000Z'), 'prior month is due');

const sameMonth = new Date();
sameMonth.setUTCDate(1);
assert(!isDueForHubertConcierge(sameMonth.toISOString()), 'same UTC month is not due again');

console.log('All organiser-exclusion checks passed.');
