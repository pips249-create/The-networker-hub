#!/usr/bin/env node
/**
 * Confirm-email reminder: timing window, skip rules, and wiring.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  AFTER_MS,
  UNTIL_MS,
  REMINDER_SLUG,
  emailVerifyReminderSkipReason,
} = require('../api/_lib/organiser-email-verify-reminder-policy');
const { BRANDED_EMAIL_TEMPLATES } = require('../api/_lib/branded-email-templates');

assert.equal(REMINDER_SLUG, 'organiser_email_verify_reminder');
assert.equal(AFTER_MS, 3 * 60 * 60 * 1000);
assert.equal(UNTIL_MS, 48 * 60 * 60 * 1000);

const now = Date.parse('2026-10-22T16:00:00.000Z');
const hoursAgo = (h) => new Date(now - h * 60 * 60 * 1000).toISOString();

assert.equal(
  emailVerifyReminderSkipReason({
    createdAt: hoursAgo(1),
    verifyTokenHash: 'abc',
    now,
  }),
  'too_soon'
);
assert.equal(
  emailVerifyReminderSkipReason({
    createdAt: hoursAgo(3.5),
    verifyTokenHash: 'abc',
    now,
  }),
  ''
);
assert.equal(
  emailVerifyReminderSkipReason({
    createdAt: hoursAgo(3.5),
    now,
  }),
  'never_started_verify',
  'soft-provisioned hub_accounts have no verify token'
);
assert.equal(
  emailVerifyReminderSkipReason({
    createdAt: hoursAgo(3.5),
    verifyTokenHash: '   ',
    now,
  }),
  'never_started_verify'
);
assert.equal(
  emailVerifyReminderSkipReason({
    createdAt: hoursAgo(50),
    verifyTokenHash: 'abc',
    now,
  }),
  'too_old'
);
assert.equal(
  emailVerifyReminderSkipReason({
    createdAt: hoursAgo(4),
    verifiedAt: hoursAgo(1),
    verifyTokenHash: 'abc',
    now,
  }),
  'already_verified'
);
assert.equal(
  emailVerifyReminderSkipReason({
    createdAt: hoursAgo(4),
    reminderSentAt: hoursAgo(1),
    verifyTokenHash: 'abc',
    now,
  }),
  'already_sent'
);
assert.equal(
  emailVerifyReminderSkipReason({
    createdAt: '',
    verifyTokenHash: 'abc',
    now,
  }),
  'missing_created_at'
);

assert.ok(BRANDED_EMAIL_TEMPLATES[REMINDER_SLUG], 'branded template config');
assert.equal(
  BRANDED_EMAIL_TEMPLATES[REMINDER_SLUG].file,
  'organiser-email-verify-reminder.html'
);
assert.match(
  BRANDED_EMAIL_TEMPLATES[REMINDER_SLUG].subject,
  /Still need to confirm/i
);

const templatePath = path.join(
  __dirname,
  '../email-templates/organiser-email-verify-reminder.html'
);
const templateHtml = fs.readFileSync(templatePath, 'utf8');
assert.match(templateHtml, /\{\{verify_code\}\}/);
assert.match(templateHtml, /\{\{verify_url\}\}/);
assert.match(templateHtml, /still waiting/i);

const cronSrc = fs.readFileSync(path.join(__dirname, '../api/cron.js'), 'utf8');
assert.match(cronSrc, /email-verify-reminders/);

const vercelSrc = fs.readFileSync(path.join(__dirname, '../vercel.json'), 'utf8');
assert.match(vercelSrc, /\/api\/cron\/email-verify-reminders/);
assert.match(vercelSrc, /25 \* \* \* \*/);

const sendSrc = fs.readFileSync(
  path.join(__dirname, '../api/_lib/organiser-email-verification.js'),
  'utf8'
);
assert.match(sendSrc, /organiser_email_verify_reminder/);

const reminderSrc = fs.readFileSync(
  path.join(__dirname, '../api/_lib/organiser-email-verify-reminders.js'),
  'utf8'
);
assert.match(reminderSrc, /slug:\s*REMINDER_SLUG/);
assert.match(reminderSrc, /organiser_email_verify_reminder_sent_at/);
assert.match(
  reminderSrc,
  /\.not\(\s*['"]organiser_email_verify_token_hash['"]\s*,\s*['"]is['"]\s*,\s*null\s*\)/,
  'must exclude soft-provisioned accounts with no confirm code'
);
assert.match(
  reminderSrc,
  /if \(hub\?\.organiser_email_verified_at\)/,
  'must re-check verified after claim'
);

const migration = fs.readFileSync(
  path.join(__dirname, '../supabase/migrations/330_email_verify_reminder.sql'),
  'utf8'
);
assert.match(migration, /organiser_email_verify_reminder_sent_at/);
assert.match(migration, /organiser_email_verify_reminder/);

const allowSrc = fs.readFileSync(
  path.join(__dirname, '../api/_lib/send-template-email.js'),
  'utf8'
);
assert.match(allowSrc, /organiser_email_verify_reminder/);

console.log('OK  email verify reminders');
