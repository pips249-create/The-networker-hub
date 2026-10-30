#!/usr/bin/env node
/**
 * Unit tests for Hubert referral search unlock (no DB).
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  REFERRAL_JOINS_FOR_UNLOCK,
  SEARCHES_PER_WEEK_BASE,
  SEARCHES_PER_WEEK_UNLOCKED,
} = require('../api/_lib/hubert-referral-unlock');
const {
  SEARCHES_PER_WEEK,
  SEARCHES_PER_WEEK_UNLOCKED: UNLOCKED_FROM_QUOTA,
  searchCapForSession,
} = require('../api/_lib/hubert-matchmaker-search-quota');

assert.strictEqual(REFERRAL_JOINS_FOR_UNLOCK, 2, '2 joined colleagues to unlock');
assert.strictEqual(SEARCHES_PER_WEEK_BASE, 3, 'base 3 searches');
assert.strictEqual(SEARCHES_PER_WEEK_UNLOCKED, 10, 'unlocked 10 searches');
assert.strictEqual(SEARCHES_PER_WEEK, 3, 'quota module base');
assert.strictEqual(UNLOCKED_FROM_QUOTA, 10, 'quota module unlocked export');
assert.strictEqual(searchCapForSession({ role: 'client' }), 3, 'sync cap stays base');
assert.strictEqual(searchCapForSession({ role: 'admin' }), 50, 'admin higher');

const auth = fs.readFileSync(path.join(__dirname, '../api/_lib/supabase-auth.js'), 'utf8');
assert.ok(auth.includes('attributeHubInviteJoin'), 'register attributes hub invites');

const ui = fs.readFileSync(path.join(__dirname, '../js/hubert-matchmaker.js'), 'utf8');
assert.ok(ui.includes('remainingToUnlock') || ui.includes('unlockedSearchCap'), 'UI shows unlock hint');

const account = fs.readFileSync(path.join(__dirname, '../account/index.html'), 'utf8');
assert.ok(account.includes('10 searches a week'), 'invite panel explains unlock');

const migration = fs.readFileSync(
  path.join(__dirname, '../supabase/migrations/346_hubert_hub_invite_joined.sql'),
  'utf8'
);
assert.ok(migration.includes('joined_at'), 'migration adds joined_at');

const orgDoc = fs.readFileSync(
  path.join(__dirname, '../docs/HUBERT-ORGANISER-COMARKETING.md'),
  'utf8'
);
assert.ok(orgDoc.includes('48 hours'), 'organiser pack timing');
assert.ok(orgDoc.includes('Who do you want to meet'), 'organiser subject');

const orgEmail = fs.readFileSync(
  path.join(__dirname, '../email-templates/hubert-organiser-pre-event.html'),
  'utf8'
);
assert.ok(orgEmail.includes('Ask Hubert who to meet'), 'organiser CTA');

const branded = fs.readFileSync(
  path.join(__dirname, '../api/_lib/branded-email-templates.js'),
  'utf8'
);
assert.ok(branded.includes('hubert_organiser_pre_event'), 'branded map');

console.log('ok — hubert referral unlock + organiser pack');
