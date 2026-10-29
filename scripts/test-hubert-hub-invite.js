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
const {
  resolveHubInvitePersona,
  HUB_INVITE_PERSONAS,
} = require('../api/_lib/hubert-hub-invite-personas');

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
const inviteHtml = fs.readFileSync(
  path.join(__dirname, '../email-templates/hubert-hub-invite.html'),
  'utf8'
);
assert.ok(inviteHtml.includes('Introductions via Hubert'), 'value prop: free intros');
assert.ok(inviteHtml.includes('UK networking events'), 'value prop: events');
assert.ok(inviteHtml.includes('logo_footer_light_url'), 'high-contrast footer logo');
assert.ok(inviteHtml.includes('background:#f5f0e8'), 'cream header for logo contrast');
assert.ok(
  fs
    .readFileSync(path.join(__dirname, '../api/_lib/send-template-email.js'), 'utf8')
    .includes('hubert-hub-invite-header-logo-datauri'),
  'send path inlines cream-header logo'
);
assert.ok(
  fs
    .readFileSync(path.join(__dirname, '../api/_lib/send-template-email.js'), 'utf8')
    .includes('hubert-hub-invite-logo-datauri'),
  'send path inlines on-dark footer logo'
);
assert.ok(
  fs.existsSync(path.join(__dirname, '../supabase/migrations/336_hubert_hub_invites.sql')),
  'migration exists'
);

assert.strictEqual(resolveHubInvitePersona('catherine').name, 'Catherine Hancher');
assert.strictEqual(resolveHubInvitePersona('rosie').email, 'rosie@thenetworkeruk.com');
assert.strictEqual(resolveHubInvitePersona('nope'), null);
assert.ok(HUB_INVITE_PERSONAS.catherine.defaultNote.includes('Catherine'));
assert.ok(HUB_INVITE_PERSONAS.rosie.defaultNote.includes('Rosie'));

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
  resolveInviterDisplay,
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

const memberDisplay = resolveInviterDisplay({
  session: { name: 'Priya Shah', email: 'priya@example.com', role: 'client' },
  inviteAs: 'catherine',
  allowPersona: false,
});
assert.strictEqual(memberDisplay.name, 'Priya Shah', 'members stay themselves');
assert.strictEqual(memberDisplay.personaKey, null, 'no persona for members');

const adminAsCatherine = resolveInviterDisplay({
  session: { name: 'Ops Admin', email: 'ops@example.com', role: 'admin' },
  inviteAs: 'catherine',
  allowPersona: true,
});
assert.strictEqual(adminAsCatherine.name, 'Catherine Hancher', 'admin can send as Catherine');
assert.strictEqual(adminAsCatherine.personaKey, 'catherine');

const adminAsRosie = resolveInviterDisplay({
  session: { name: 'Ops Admin', email: 'ops@example.com', role: 'admin' },
  inviteAs: 'rosie',
  allowPersona: true,
});
assert.strictEqual(adminAsRosie.name, 'Rosie McGilvray', 'admin can send as Rosie');

const sendSrc = fs.readFileSync(path.join(__dirname, '../api/_lib/send-template-email.js'), 'utf8');
assert.ok(sendSrc.includes("'hubert_hub_invite'"), 'transactional slug registered');

const routeSrc = fs.readFileSync(
  path.join(__dirname, '../api/_lib/routes/auth-hubert-matchmaker.js'),
  'utf8'
);
assert.ok(routeSrc.includes("action === 'invite'"), 'auth route invite action');
assert.ok(routeSrc.includes('sendHubInvite'), 'auth route calls sendHubInvite');

const adminRouteSrc = fs.readFileSync(
  path.join(__dirname, '../api/_lib/routes/admin-hubert-matchmaker.js'),
  'utf8'
);
assert.ok(adminRouteSrc.includes('allowPersona: true'), 'admin seed invites allow persona');
assert.ok(adminRouteSrc.includes('inviteAs'), 'admin seed passes inviteAs');

const adminAppSrc = fs.readFileSync(path.join(__dirname, '../js/admin-app.js'), 'utf8');
assert.ok(adminAppSrc.includes('hmm-seed-invite-as'), 'admin UI invite-as picker');
assert.ok(adminAppSrc.includes('Catherine Hancher'), 'Catherine option in UI');
assert.ok(adminAppSrc.includes('Rosie McGilvray'), 'Rosie option in UI');

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

  // Member cannot force Catherine even if they pass inviteAs
  const memberPersonaBlocked = resolveInviterDisplay({
    session,
    inviteAs: 'catherine',
    allowPersona: false,
  });
  assert.strictEqual(memberPersonaBlocked.name, 'Me', 'persona blocked without allowPersona');
}

runValidation()
  .then(function () {
    console.log('ok — hubert hub invite');
  })
  .catch(function (err) {
    console.error('FAIL:', err && err.message ? err.message : err);
    process.exit(1);
  });
