/**
 * Hubert monthly digest must only target attendee rows linked to Auth.
 * Usage: node scripts/test-hubert-concierge-eligibility.js
 */
const { hasLinkedAttendeeAccount } = require('../api/_lib/attendee-member-account');

function assert(label, ok) {
  if (!ok) {
    console.error('FAIL:', label);
    process.exitCode = 1;
  } else {
    console.log('ok:', label);
  }
}

assert('checkout-only row rejected', !hasLinkedAttendeeAccount({ email: 'a@b.com' }));
assert('linked member accepted', hasLinkedAttendeeAccount({ supabase_user_id: 'uuid-1' }));
assert('empty user id rejected', !hasLinkedAttendeeAccount({ supabase_user_id: '  ' }));

if (!process.exitCode) console.log('All Hubert concierge eligibility checks passed');
