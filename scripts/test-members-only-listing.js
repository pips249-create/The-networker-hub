#!/usr/bin/env node
/**
 * Closed members-only listing vs guest-visit / membership-after-visits.
 * Run: node scripts/test-members-only-listing.js
 */
const {
  isClosedMembersOnlyEvent,
  isMembersOnlyTicket,
} = require('../api/_lib/ticket-visibility');

let failed = 0;

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

assert(
  'closed tickets mode with only members_only tiers',
  isClosedMembersOnlyEvent({
    attendanceMode: 'tickets',
    membersOnlyTierCount: 1,
    publicTiersCount: 0,
    hasGuestVisitTier: false,
  }) === true
);

assert(
  'membership_meeting with member tier + guest visits is not closed',
  isClosedMembersOnlyEvent({
    attendanceMode: 'membership_meeting',
    membersOnlyTierCount: 1,
    publicTiersCount: 0,
    hasGuestVisitTier: true,
  }) === false
);

assert(
  'membership_meeting without public tiers is not closed (guest path by mode)',
  isClosedMembersOnlyEvent({
    attendanceMode: 'membership_meeting',
    membersOnlyTierCount: 1,
    publicTiersCount: 0,
    hasGuestVisitTier: false,
  }) === false
);

assert(
  'guest_programme is not closed',
  isClosedMembersOnlyEvent({
    attendanceMode: 'guest_programme',
    membersOnlyTierCount: 1,
    publicTiersCount: 0,
    hasGuestVisitTier: true,
  }) === false
);

assert(
  'category_exclusivity with member price is not closed',
  isClosedMembersOnlyEvent({
    attendanceMode: 'category_exclusivity',
    membersOnlyTierCount: 1,
    publicTiersCount: 0,
    hasGuestVisitTier: false,
  }) === false
);

assert(
  'guest visit tier blocks closed flag even in tickets mode',
  isClosedMembersOnlyEvent({
    attendanceMode: 'tickets',
    membersOnlyTierCount: 1,
    publicTiersCount: 0,
    hasGuestVisitTier: true,
  }) === false
);

assert(
  'public ticket alongside member tier is not closed',
  isClosedMembersOnlyEvent({
    attendanceMode: 'tickets',
    membersOnlyTierCount: 1,
    publicTiersCount: 1,
    hasGuestVisitTier: false,
  }) === false
);

assert(
  'members_only ticket detection',
  isMembersOnlyTicket({ visibility: 'members_only' }) &&
    !isMembersOnlyTicket({ visibility: 'public' })
);

// Mirror client listingPriceLabel behaviour for GenNet-style events.
function listingPriceLabelStub(ev) {
  const mode = String(ev?.attendanceMode || '').trim();
  if (mode === 'guest_programme' || mode === 'membership_meeting') {
    const member =
      ev.priceKey === 'free' || /^free$/i.test(String(ev.price || '')) ? 'Free' : String(ev.price);
    const allowed = Number(ev.complimentaryVisitsAllowed) || 0;
    const trial =
      allowed < 1
        ? ''
        : allowed === 1
          ? 'up to 1 free visit'
          : 'up to ' + allowed + ' free visits';
    return trial ? member + ' · ' + trial : member;
  }
  if (ev.isMembersOnlyEvent) return 'Members only';
  return ev.priceKey === 'free' ? 'Free' : String(ev.price || 'Free');
}

assert(
  'GenNet-style badge is Free · up to 2 free visits (not Members only)',
  listingPriceLabelStub({
    attendanceMode: 'membership_meeting',
    isMembersOnlyEvent: true, // stale/wrong API flag must not win
    priceKey: 'free',
    price: 'Free',
    complimentaryVisitsAllowed: 2,
  }) === 'Free · up to 2 free visits'
);

if (failed) {
  console.error('\n' + failed + ' assertion(s) failed');
  process.exit(1);
}
console.log('\nAll members-only listing checks passed');
