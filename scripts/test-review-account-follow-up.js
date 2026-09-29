#!/usr/bin/env node
const { buildReviewAccountFollowUp } = require('../api/_lib/review-account-follow-up');

const guest = buildReviewAccountFollowUp(
  { email: 'guest@example.com', supabase_user_id: null, company: '', job_title: '' },
  { includeEmailInUrls: true }
);
if (guest.hasLinkedAccount) {
  console.error('FAIL: expected guest');
  process.exit(1);
}
if (!guest.registerUrl.includes('guest%40example.com')) {
  console.error('FAIL: register URL should include email');
  process.exit(1);
}
if (!guest.profileNeedsDetails) {
  console.error('FAIL: profile should need details');
  process.exit(1);
}

const member = buildReviewAccountFollowUp(
  { email: 'member@example.com', supabase_user_id: 'uuid-123', company: 'Acme', job_title: 'CEO' },
  { includeEmailInUrls: true }
);
if (!member.hasLinkedAccount || member.registerUrl) {
  console.error('FAIL: linked member should not get register URL');
  process.exit(1);
}

console.log('OK: review account follow-up URLs');
