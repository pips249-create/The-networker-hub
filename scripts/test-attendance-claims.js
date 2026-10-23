#!/usr/bin/env node
/**
 * Unit checks for attendance-claim tokens + ranking weights.
 */
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'unit-test-session-secret';

const {
  createAttendanceClaimToken,
  verifyAttendanceClaimToken,
} = require('../api/_lib/attendance-claim-token');
const {
  computeWeightedReviewStats,
  ORGANISER_CONFIRMED_WEIGHT,
  provenanceWeight,
} = require('../api/_lib/attendance-claim-weights');

const claimId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const organiserId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const token = createAttendanceClaimToken({ claimId, organiserId });
const payload = verifyAttendanceClaimToken(token);
if (!payload || payload.claimId !== claimId || payload.organiserId !== organiserId) {
  console.error('FAIL: attendance claim token round-trip');
  process.exit(1);
}

if (verifyAttendanceClaimToken('not.a.token') != null) {
  console.error('FAIL: expected invalid token to fail');
  process.exit(1);
}

if (provenanceWeight('verified') !== 1) {
  console.error('FAIL: verified weight');
  process.exit(1);
}
if (provenanceWeight('organiser_confirmed') !== ORGANISER_CONFIRMED_WEIGHT) {
  console.error('FAIL: organiser_confirmed weight');
  process.exit(1);
}

const mixed = computeWeightedReviewStats([
  { rating: 5, provenance: 'verified' },
  { rating: 5, provenance: 'verified' },
  { rating: 5, provenance: 'organiser_confirmed' },
  { rating: 5, provenance: 'organiser_confirmed' },
  { rating: 5, provenance: 'organiser_confirmed' },
  { rating: 5, provenance: 'organiser_confirmed' },
]);
// verified units = 2; confirmed units = 2; cap confirmed to ≤ verified → 2
// weighted count = 2 + 2 = 4
if (Math.abs(mixed.weightedReviewCount - 4) > 0.01) {
  console.error('FAIL: expected capped weighted count 4, got', mixed.weightedReviewCount);
  process.exit(1);
}

const confirmedOnly = computeWeightedReviewStats([
  { rating: 4, provenance: 'organiser_confirmed' },
  { rating: 5, provenance: 'organiser_confirmed' },
]);
// 0.5 + 0.5 = 1
if (Math.abs(confirmedOnly.weightedReviewCount - 1) > 0.01) {
  console.error('FAIL: confirmed-only weighted count', confirmedOnly.weightedReviewCount);
  process.exit(1);
}
if (Math.abs(confirmedOnly.weightedAverageRating - 4.5) > 0.01) {
  console.error('FAIL: confirmed-only average', confirmedOnly.weightedAverageRating);
  process.exit(1);
}

const {
  reviewerDisplayName,
  organiserFacingAttendeeName,
} = require('../api/_lib/reviewer-display-name');

const anonAttendee = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  name: 'Catherine Networker',
  email: 'catherine@the-networker.co.uk',
  public_review_name: '__networker__',
};
if (reviewerDisplayName(anonAttendee) !== 'Networker ' + require('../api/_lib/reviewer-display-name').networkerNumberFromId(anonAttendee.id)) {
  console.error('FAIL: public review name should stay anonymous Networker alias');
  process.exit(1);
}
if (organiserFacingAttendeeName(anonAttendee) !== 'Catherine N.') {
  console.error(
    'FAIL: organiser-facing claim name should use account name, got',
    organiserFacingAttendeeName(anonAttendee)
  );
  process.exit(1);
}
if (organiserFacingAttendeeName({ email: 'jamie@thenetworkeruk.com' }) !== 'Jamie') {
  console.error('FAIL: organiser-facing fallback from email local-part');
  process.exit(1);
}

console.log('OK: attendance claim token + ranking weights + organiser-facing names');
