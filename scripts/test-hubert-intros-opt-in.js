#!/usr/bin/env node
/**
 * Smoke for Hubert signup / first-login opt-in wiring.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  matchmakerProfileFromAttendee,
} = require('../api/_lib/hubert-matchmaker-profile');

const empty = matchmakerProfileFromAttendee({});
assert.strictEqual(empty.shouldPromptHubertIntros, true, 'new members get the prompt');
assert.strictEqual(empty.hubertIntrosInterested, false, 'not interested yet');
assert.strictEqual(empty.preferDiscoverable, false, 'do not pre-check Include me');

const interested = matchmakerProfileFromAttendee({
  hubert_intros_interest_at: '2026-10-29T12:00:00.000Z',
  matchmaker_blurb: '',
  looking_to_meet: [],
  discoverable_at: null,
});
assert.strictEqual(interested.hubertIntrosInterested, true, 'signup opt-in counted');
assert.strictEqual(interested.shouldPromptHubertIntros, false, 'skip modal after interest');
assert.strictEqual(interested.preferDiscoverable, true, 'pre-check Include me after interest');

const dismissed = matchmakerProfileFromAttendee({
  hubert_intros_prompt_dismissed_at: '2026-10-29T12:00:00.000Z',
});
assert.strictEqual(dismissed.shouldPromptHubertIntros, false, 'Maybe later stops the prompt');

const ready = matchmakerProfileFromAttendee({
  matchmaker_blurb: 'Founder building B2B SaaS',
  looking_to_meet: ['Clients'],
  discoverable_at: '2026-10-29T12:00:00.000Z',
});
assert.strictEqual(ready.matchmakerReady, true, 'ready profile');
assert.strictEqual(ready.shouldPromptHubertIntros, false, 'no prompt when ready');

const registerHtml = fs.readFileSync(path.join(__dirname, '../register.html'), 'utf8');
assert.ok(registerHtml.includes('register-hubert'), 'signup checkbox present');
assert.ok(registerHtml.includes('Hubert'), 'checkbox mentions Hubert');

const authJs = fs.readFileSync(path.join(__dirname, '../js/auth.js'), 'utf8');
assert.ok(authJs.includes('hubertOptIn'), 'register payload sends hubertOptIn');

const registerRoute = fs.readFileSync(
  path.join(__dirname, '../api/_lib/routes/auth-register.js'),
  'utf8'
);
assert.ok(registerRoute.includes('hubertOptIn'), 'register route reads hubertOptIn');

const sbAuth = fs.readFileSync(path.join(__dirname, '../api/_lib/supabase-auth.js'), 'utf8');
assert.ok(sbAuth.includes('hubert_intros_interest_at'), 'register persists interest');

const accountHtml = fs.readFileSync(path.join(__dirname, '../account/index.html'), 'utf8');
assert.ok(accountHtml.includes('ad-hubert-optin-modal'), 'dashboard modal markup');
assert.ok(accountHtml.includes('Enable intros'), 'Enable intros CTA');

const hmm = fs.readFileSync(path.join(__dirname, '../js/hubert-matchmaker.js'), 'utf8');
assert.ok(hmm.includes('shouldPromptHubertIntros'), 'client shows prompt from profile');
assert.ok(hmm.includes('hubertIntrosInterest'), 'Enable persists interest');
assert.ok(hmm.includes('hubertIntrosPromptDismiss'), 'Maybe later dismisses');

const migration = fs.readFileSync(
  path.join(__dirname, '../supabase/migrations/341_hubert_intros_opt_in.sql'),
  'utf8'
);
assert.ok(migration.includes('hubert_intros_interest_at'), 'migration interest column');
assert.ok(migration.includes('hubert_intros_prompt_dismissed_at'), 'migration dismiss column');

console.log('ok — hubert intros opt-in');
