/**
 * Unit checks for Link Out attend enquiry helpers.
 * Run: node scripts/test-event-attend-enquiry.js
 */
const assert = require('assert');
const {
  emailFromMailtoUrl,
  isLinkOutEmailEvent,
} = require('../api/_lib/event-attend-enquiry');

assert.strictEqual(emailFromMailtoUrl('sara@4nonline.biz'), 'sara@4nonline.biz');
assert.strictEqual(emailFromMailtoUrl('mailto:Sara@Example.COM'), 'sara@example.com');
assert.strictEqual(emailFromMailtoUrl('https://www.eventbrite.co.uk/e/test'), '');
assert.ok(
  isLinkOutEmailEvent({
    checkout_mode: 'external_link',
    external_booking_url: 'book@group.com',
  })
);
assert.ok(
  !isLinkOutEmailEvent({
    checkout_mode: 'external_link',
    external_booking_url: 'https://tickets.example.com',
  })
);

console.log('All event attend enquiry checks passed.');
