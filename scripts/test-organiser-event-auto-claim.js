#!/usr/bin/env node
/**
 * Organiser-listed events accept the page. Admin and Impersonate listings do not.
 * Usage: node scripts/test-organiser-event-auto-claim.js
 */
const {
  shouldAutoClaimOrganiserOnEventCreate,
  claimOrganiserPageForListedEvent,
} = require('../api/_lib/supabase-organiser-claims');

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL:', label);
    process.exitCode = 1;
    return false;
  }
  return true;
}

const organiser = { sub: '11111111-1111-4111-8111-111111111111', email: 'stephanie@networkb2b.co.uk' };
const impersonating = {
  ...organiser,
  impersonator: { email: 'jamie@thenetworkeruk.com', sub: '22222222-2222-4222-8222-222222222222' },
};

assert('organiser listing accepts the page', shouldAutoClaimOrganiserOnEventCreate(organiser));
assert(
  'impersonated listing stays unclaimed',
  !shouldAutoClaimOrganiserOnEventCreate(impersonating)
);
assert(
  'admin workspace listing stays unclaimed',
  !shouldAutoClaimOrganiserOnEventCreate(organiser, { adminView: true })
);
assert('missing session does not claim', !shouldAutoClaimOrganiserOnEventCreate(null));
assert('session without a user id does not claim', !shouldAutoClaimOrganiserOnEventCreate({ email: organiser.email }));

(async function run() {
  const staff = await claimOrganiserPageForListedEvent(impersonating, organiser.sub);
  assert('impersonation short-circuits before claim', staff && staff.claimed === false && staff.reason === 'staff_or_admin');

  const adminView = await claimOrganiserPageForListedEvent(organiser, organiser.sub, { adminView: true });
  assert('admin view short-circuits before claim', adminView && adminView.claimed === false && adminView.reason === 'staff_or_admin');

  const missing = await claimOrganiserPageForListedEvent(organiser, '  ');
  assert('missing group does not claim', missing && missing.claimed === false && missing.reason === 'missing_id');

  if (!process.exitCode) {
    console.log('All organiser event auto-claim checks passed');
  }
})().catch(function (err) {
  console.error('FAIL:', err && err.message ? err.message : err);
  process.exitCode = 1;
});
