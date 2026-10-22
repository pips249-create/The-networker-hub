#!/usr/bin/env node
/**
 * Smoke assertions for the signed-out "List your → Organiser" account gate.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('ok:', msg);
  }
}

const page = read('organiser/list-account.html');
const pageJs = read('js/organiser-list-account.js');
const nav = read('js/site-nav.js');
const actions = read('js/hub-organiser-actions.js');
const groupEdit = read('js/organiser-group-edit.js');

assert(page.includes('Create an account first'), 'gate page explains account is required');
assert(
  page.includes('You must create a free Networker UK account before adding your organiser group'),
  'gate page copy matches product intent'
);
assert(page.includes('/register?intent=organiser'), 'gate page links to create account');
assert(page.includes('/login?intent=organiser'), 'gate page links to sign in');
assert(pageJs.includes('/organiser/group-edit'), 'signed-in visitors continue to group-edit');
assert(nav.includes("'/organiser/list-account'"), 'nav points signed-out users to gate');
assert(nav.includes('function listOrganiserPath'), 'nav has listOrganiserPath helper');
assert(actions.includes('accountGate: true'), 'goToGroupProfile uses account gate');
assert(actions.includes('LIST_ACCOUNT_PATH'), 'actions export list-account path');
assert(groupEdit.includes('/organiser/list-account'), 'group-edit redirects unsigned create flow to gate');

if (process.exitCode) {
  console.error('\nlist-organiser account gate checks failed');
  process.exit(1);
}
console.log('\nlist-organiser account gate checks passed');
