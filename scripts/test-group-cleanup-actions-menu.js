#!/usr/bin/env node
/**
 * Fix listings Groups row: Actions dropdown, no per-row Send reminder.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const adminSrc = fs.readFileSync(path.join(__dirname, '../js/admin-app.js'), 'utf8');
const cssSrc = fs.readFileSync(path.join(__dirname, '../css/admin-console.css'), 'utf8');

assert.match(adminSrc, /function groupCleanupRowActionsHtml/);
assert.match(adminSrc, /admin-group-actions-toggle/);
assert.match(adminSrc, /Actions <span aria-hidden="true"/);
assert.match(adminSrc, /salesKitDropdownHtml\(o, \{ embedded: true \}\)/);
assert.match(adminSrc, /bindGroupActionsMenus\(\)/);
assert.doesNotMatch(
  adminSrc,
  /Send reminder<\/button>/,
  'per-row Send reminder button must be removed'
);
assert.doesNotMatch(
  adminSrc,
  /data-send-unclaimed-followup=/,
  'per-row unclaimed follow-up button attribute must be removed'
);
assert.match(
  adminSrc,
  /id="group-email-unclaimed-btn"/,
  'bulk Email unclaimed groups control should remain'
);
assert.match(adminSrc, /groupCleanupRowActionsHtml\(o, \{ isOpen: isOpen, publicHref: publicHref \}\)/);
assert.match(cssSrc, /\.admin-group-actions-panel/);
assert.match(cssSrc, /\.admin-group-actions-item--danger/);

console.log('OK  group cleanup Actions menu (no row Send reminder)');
