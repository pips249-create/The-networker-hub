#!/usr/bin/env node
/**
 * Organiser-listed events accept the page. Admin and Impersonate listings do not.
 * Usage: node scripts/test-organiser-event-auto-claim.js
 */
const {
  shouldAutoClaimOrganiserOnEventCreate,
  claimOrganiserPageForListedEvent,
  isStaffEventListingRecord,
  shouldClaimPageForExistingOrganiserEvents,
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

  assert(
    'signed-in organiser with their own events is claimed',
    shouldClaimPageForExistingOrganiserEvents({
      claimStatus: 'pending',
      eventCount: 155,
      signedIn: true,
      staffListedEvents: false,
    })
  );
  assert(
    'staff-listed events stay unclaimed',
    !shouldClaimPageForExistingOrganiserEvents({
      claimStatus: 'pending',
      eventCount: 2,
      signedIn: true,
      staffListedEvents: true,
    })
  );
  assert(
    'a provisioned login that never signed in stays unclaimed',
    !shouldClaimPageForExistingOrganiserEvents({
      claimStatus: 'pending',
      eventCount: 155,
      signedIn: false,
      staffListedEvents: false,
    })
  );
  assert(
    'no events does not claim',
    !shouldClaimPageForExistingOrganiserEvents({
      claimStatus: 'pending',
      eventCount: 0,
      signedIn: true,
      staffListedEvents: false,
    })
  );
  assert(
    'already claimed is left alone',
    !shouldClaimPageForExistingOrganiserEvents({
      claimStatus: 'claimed',
      eventCount: 4,
      signedIn: true,
      staffListedEvents: false,
    })
  );
  assert('staff event create log is a staff listing', isStaffEventListingRecord({ source: 'event_create' }));
  assert(
    'listed-an-event note is a staff listing',
    isStaffEventListingRecord({ notes: '2026-09-16: Listed an event — “Breakfast”' })
  );
  assert('impersonate-only log is not a staff listing', !isStaffEventListingRecord({ source: 'impersonate', notes: 'Impersonated workspace' }));

  if (!process.exitCode) {
    console.log('All organiser event auto-claim checks passed');
  }
})().catch(function (err) {
  console.error('FAIL:', err && err.message ? err.message : err);
  process.exitCode = 1;
});
