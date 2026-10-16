#!/usr/bin/env node
const assert = require('assert');
const {
  shouldPreserveListingLifecycle,
  applyListingLifecyclePreserve,
  preservePeerContentFields,
} = require('../api/_lib/listing-lifecycle');

assert.strictEqual(shouldPreserveListingLifecycle({ status: 'published' }), true);
assert.strictEqual(shouldPreserveListingLifecycle({ status: 'unpublished' }), true);
assert.strictEqual(shouldPreserveListingLifecycle({ status: 'draft' }), false);
assert.strictEqual(
  shouldPreserveListingLifecycle({
    status: 'draft',
    published_at: '2026-08-18T10:14:26.193+00:00',
  }),
  true
);

const demotingPatch = {
  id: 'new-id',
  status: 'draft',
  approval_status: 'Pending Review',
  ticket_sales_enabled: false,
  title: 'Updated title',
};
const preserved = applyListingLifecyclePreserve(demotingPatch, {
  status: 'published',
  approval_status: 'Approved',
  ticket_sales_enabled: false,
  published_at: '2026-08-18T10:14:26.193+00:00',
});
assert.strictEqual(preserved.status, 'published');
assert.strictEqual(preserved.approval_status, 'Approved');
assert.strictEqual(preserved.title, 'Updated title');
assert.strictEqual(preserved.id, undefined);

// Create-mode series template nulls must not wipe peer description/venue.
const wipingTemplate = {
  title: 'The MarTech Summit London 2026',
  description: null,
  venue: null,
  city: null,
  address: null,
  status: 'draft',
};
const peer = {
  status: 'published',
  approval_status: 'Approved',
  published_at: '2026-10-01T10:00:00.000Z',
  description: 'Full summit agenda and speakers.',
  venue: 'Convene 155 Bishopsgate',
  city: 'London',
  address: '155 Bishopsgate',
};
const contentSafe = applyListingLifecyclePreserve(wipingTemplate, peer);
assert.strictEqual(contentSafe.description, undefined, 'null description must not patch over peer');
assert.strictEqual(contentSafe.venue, undefined, 'null venue must not patch over peer');
assert.strictEqual(contentSafe.city, undefined);
assert.strictEqual(contentSafe.status, 'published');

const kept = preservePeerContentFields(
  { description: 'New copy from organiser', venue: null },
  peer
);
assert.strictEqual(kept.description, 'New copy from organiser');
assert.strictEqual(kept.venue, undefined);

console.log('test-listing-lifecycle: ok');
