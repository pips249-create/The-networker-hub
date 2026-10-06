#!/usr/bin/env node
const assert = require('assert');

function withEnv(overrides, fn) {
  const prev = {};
  for (const key of Object.keys(overrides)) {
    prev[key] = process.env[key];
    if (overrides[key] == null) delete process.env[key];
    else process.env[key] = overrides[key];
  }
  try {
    // Re-require after env change
    delete require.cache[require.resolve('../api/_lib/hub-email-urls')];
    delete require.cache[require.resolve('../api/_lib/hub-brand')];
    return fn(require('../api/_lib/hub-email-urls'));
  } finally {
    for (const key of Object.keys(overrides)) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    }
    delete require.cache[require.resolve('../api/_lib/hub-email-urls')];
    delete require.cache[require.resolve('../api/_lib/hub-brand')];
  }
}

withEnv({ SUPPORT_EMAIL: '', RESEND_FROM: 'The Networker UK <hello@mail.thenetworkeruk.com>' }, (mod) => {
  assert.strictEqual(mod.supportEmail(), 'hi@thenetworkeruk.com');
});
withEnv({ SUPPORT_EMAIL: '', RESEND_FROM: 'hello@mail.thenetworkerhub.com' }, (mod) => {
  assert.strictEqual(mod.supportEmail(), 'hi@thenetworkeruk.com');
});
withEnv({ SUPPORT_EMAIL: 'hello@mail.thenetworkeruk.com', RESEND_FROM: '' }, (mod) => {
  assert.strictEqual(mod.supportEmail(), 'hi@thenetworkeruk.com');
});
withEnv({ SUPPORT_EMAIL: 'hi@thenetworkeruk.com', RESEND_FROM: 'hello@mail.thenetworkeruk.com' }, (mod) => {
  assert.strictEqual(mod.supportEmail(), 'hi@thenetworkeruk.com');
});
console.log('ok — supportEmail is hi@thenetworkeruk.com, not mail.* From');

const fs = require('fs');
const path = require('path');
const reminder = fs.readFileSync(
  path.join(__dirname, '../email-templates/booking-reminder-24hr.html'),
  'utf8'
);
assert.ok(reminder.includes('mailto:{{support_email}}'));
assert.ok(reminder.includes('Questions about this event? Email'));
console.log('ok — booking help copy points at support_email (hi@)');

console.log('\nAll support-email checks passed.');
