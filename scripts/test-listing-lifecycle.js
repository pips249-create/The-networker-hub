#!/usr/bin/env node
const assert = require('assert');
const {
  shouldPreserveListingLifecycle,
  applyListingLifecyclePreserve,
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

console.log('test-listing-lifecycle: ok');
