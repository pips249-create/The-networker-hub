#!/usr/bin/env node
const { createReviewLinkToken, verifyReviewLinkToken } = require('../api/_lib/review-link-token');
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'unit-test-session-secret';

const eventId = '11111111-1111-4111-8111-111111111111';
const token = createReviewLinkToken({
  registrationId: '22222222-2222-4222-8222-222222222222',
  eventId,
  attendeeId: '33333333-3333-4333-8333-333333333333',
});

const payload = verifyReviewLinkToken(token);
if (!payload || payload.eventId !== eventId) {
  console.error('FAIL: token round-trip');
  process.exit(1);
}

const url =
  'https://www.thenetworkeruk.com/events/leave-review.html?token=' + encodeURIComponent(token);
if (!url.includes('leave-review.html')) {
  console.error('FAIL: expected leave-review URL');
  process.exit(1);
}

console.log('OK: review link token + URL');
