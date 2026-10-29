#!/usr/bin/env node
/**
 * Smoke for Hubert Hub invite registration + pure helpers.
 * Avoids loading send-template-email (needs @supabase/supabase-js).
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');

const { BRANDED_EMAIL_TEMPLATES } = require('../api/_lib/branded-email-templates');

assert.ok(BRANDED_EMAIL_TEMPLATES.hubert_hub_invite, 'branded template registered');
assert.strictEqual(
  BRANDED_EMAIL_TEMPLATES.hubert_hub_invite.file,
  'hubert-hub-invite.html',
  'branded file'
);
assert.ok(
  fs.existsSync(path.join(__dirname, '../email-templates/hubert-hub-invite.html')),
  'email html exists'
);
assert.ok(
  fs.existsSync(path.join(__dirname, '../supabase/migrations/334_hubert_hub_invites.sql')),
  'migration exists'
);

const sendTplPath = require.resolve('../api/_lib/send-template-email');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === './send-template-email' || request === sendTplPath) {
    return {
      sendTemplatedEmail: async function () {
        return { id: 'mock-resend' };
      },
    };
  }
  return originalLoad.apply(this, arguments);
};

const {
  MEMBER_WEEKLY_CAP,
  ADMIN_WEEKLY_CAP,
  sessionUserId,
  weeklyCapForSession,
  sendHubInvite,
} = require('../api/_lib/hubert-hub-invite');

Module._load = originalLoad;

assert.strictEqual(MEMBER_WEEKLY_CAP, 5, 'member cap 5');
assert.strictEqual(ADMIN_WEEKLY_CAP, 50, 'admin cap 50');
assert.strictEqual(weeklyCapForSession({ role: 'admin' }), 50, 'admin weekly');
assert.strictEqual(weeklyCapForSession({ role: 'client' }), 5, 'member weekly');
assert.strictEqual(sessionUserId({ sub: 'u-1' }), 'u-1', 'prefer sub');
assert.strictEqual(sessionUserId({ userId: 'u-2' }), 'u-2', 'userId fallback');
assert.strictEqual(sessionUserId({}), null, 'empty session');

const sendSrc = fs.readFileSync(path.join(__dirname, '../api/_lib/send-template-email.js'), 'utf8');
assert.ok(sendSrc.includes("'hubert_hub_invite'"), 'transactional slug registered');

const routeSrc = fs.readFileSync(
  path.join(__dirname, '../api/_lib/routes/auth-hubert-matchmaker.js'),
  'utf8'
);
assert.ok(routeSrc.includes("action === 'invite'"), 'auth route invite action');
assert.ok(routeSrc.includes('sendHubInvite'), 'auth route calls sendHubInvite');

async function runValidation() {
  const sb = {
    from() {
      throw new Error('should not hit db for validation failures');
    },
  };
  const session = { sub: 'user-1', email: 'me@example.com', name: 'Me', role: 'client' };

  let r = await sendHubInvite({
    sb,
    session,
    inviteeName: 'A',
    inviteeEmail: 'alex@example.com',
  });
  assert.strictEqual(r.error, 'name_required', 'short name');

  r = await sendHubInvite({
    sb,
    session,
    inviteeName: 'Alex',
    inviteeEmail: 'not-an-email',
  });
  assert.strictEqual(r.error, 'email_invalid', 'bad email');

  r = await sendHubInvite({
    sb,
    session,
    inviteeName: 'Alex',
    inviteeEmail: 'me@example.com',
  });
  assert.strictEqual(r.error, 'self_invite', 'self invite');
}

runValidation()
  .then(function () {
    console.log('ok — hubert hub invite');
  })
  .catch(function (err) {
    console.error('FAIL:', err && err.message ? err.message : err);
    process.exit(1);
  });
