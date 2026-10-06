#!/usr/bin/env node
const assert = require('assert');
const {
  isAttendeeEventReplyToOrganiserSlug,
  ATTENDEE_EVENT_REPLY_TO_ORGANISER_SLUGS,
} = require('../api/_lib/attendee-event-reply-to');
const { isStaleBookingReminderTemplate } = require('../api/_lib/booking-reminder-template');
const { isStaleBookingTemplate } = require('../api/_lib/booking-confirmation-template');
const fs = require('fs');
const path = require('path');

assert.ok(isAttendeeEventReplyToOrganiserSlug('booking_reminder'));
assert.ok(isAttendeeEventReplyToOrganiserSlug('booking_confirmation'));
assert.ok(isAttendeeEventReplyToOrganiserSlug('online_join_reminder'));
assert.ok(isAttendeeEventReplyToOrganiserSlug('meeting_link_added'));
assert.ok(!isAttendeeEventReplyToOrganiserSlug('account_welcome'));
assert.ok(ATTENDEE_EVENT_REPLY_TO_ORGANISER_SLUGS.size >= 5);
console.log('ok — organiser reply-to slug set');

const reminderHtml = fs.readFileSync(
  path.join(__dirname, '../email-templates/booking-reminder-24hr.html'),
  'utf8'
);
assert.ok(reminderHtml.includes('Questions about this event? Just reply to this email'));
assert.ok(!isStaleBookingReminderTemplate(reminderHtml));
assert.ok(
  isStaleBookingReminderTemplate(
    reminderHtml.replace(
      'Questions about this event? Just reply to this email',
      'Need help? <a href="mailto:{{support_email}}">{{support_email}}</a>'
    )
  )
);
console.log('ok — booking reminder template prefers reply-to-organiser copy');

const confirmHtml = fs.readFileSync(
  path.join(__dirname, '../email-templates/booking-confirmation.html'),
  'utf8'
);
assert.ok(confirmHtml.includes('Questions about this event? Just reply to this email'));
assert.ok(!isStaleBookingTemplate(confirmHtml));
assert.ok(
  isStaleBookingTemplate(
    confirmHtml.replace(
      'Questions about this event? Just reply to this email',
      'Need help? <a href="mailto:{{support_email}}">{{support_email}}</a>'
    )
  )
);
console.log('ok — booking confirmation copy updated');

console.log('\nAll attendee-event reply-to checks passed.');
