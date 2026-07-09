#!/usr/bin/env node
/**
 * Apply shared mobile layout fixes to all HTML email templates.
 * Run: node scripts/patch-email-mobile.js
 */
const fs = require('fs');
const path = require('path');
const { patchEmailMobileStyles } = require('../api/_lib/email-mobile-styles');

const dir = path.join(__dirname, '../email-templates');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.html'));

let changed = 0;
for (const file of files) {
  const filePath = path.join(dir, file);
  const before = fs.readFileSync(filePath, 'utf8');
  const after = patchEmailMobileStyles(before);
  if (after !== before) {
    fs.writeFileSync(filePath, after);
    changed += 1;
    console.log('patched', file);
  }
}

console.log('Done —', changed, 'file(s) updated.');
