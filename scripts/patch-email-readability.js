#!/usr/bin/env node
/**
 * Bump email typography and contrast for 40–55 readability (matches site UX pass).
 * Run: node scripts/patch-email-readability.js
 */
const fs = require('fs');
const path = require('path');
const { patchEmailReadability } = require('../api/_lib/email-readability');

const roots = [
  path.join(__dirname, '../email-templates'),
  path.join(__dirname, '../api/_lib'),
];

function collectFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.html') || f.endsWith('.js'))
    .map((f) => path.join(dir, f))
    .filter((f) => !f.endsWith('email-readability.js'));
}

let changed = 0;
for (const dir of roots) {
  for (const filePath of collectFiles(dir)) {
    const before = fs.readFileSync(filePath, 'utf8');
    const after = patchEmailReadability(before);
    if (after !== before) {
      fs.writeFileSync(filePath, after);
      changed += 1;
      console.log('patched', path.relative(path.join(__dirname, '..'), filePath));
    }
  }
}

console.log('Done —', changed, 'file(s) updated.');
