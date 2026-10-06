#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { isStaleBookingReminderTemplate } = require('../api/_lib/booking-reminder-template');
const { isStaleBookingTemplate } = require('../api/_lib/booking-confirmation-template');

const reminder = fs.readFileSync(
  path.join(__dirname, '../email-templates/booking-reminder-24hr.html'),
  'utf8'
);
const confirm = fs.readFileSync(
  path.join(__dirname, '../email-templates/booking-confirmation.html'),
  'utf8'
);

assert.ok(reminder.includes('Questions about this event? Reply and we'));
assert.ok(confirm.includes('Questions about this event? Reply and we'));
assert.ok(!reminder.includes('Just reply to this email'));
assert.ok(!isStaleBookingReminderTemplate(reminder));
assert.ok(!isStaleBookingTemplate(confirm));
console.log('ok — event help copy keeps Hub as relay without exposing organiser email');
