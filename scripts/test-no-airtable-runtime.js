#!/usr/bin/env node
/**
 * Guard: runtime code must not call Airtable Public API.
 * Historical migrate.js / MIGRATE.md may still mention Airtable.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const banned = [
  /api\.airtable\.com/,
  /AIRTABLE_API_KEY/,
  /AIRTABLE_BASE_ID/,
  /airtableFetch\s*\(/,
  /airtableConfig\s*\(/,
  /testAirtableConnection/,
];

const allowFiles = new Set([
  path.join(root, 'migrate.js'),
  path.join(root, 'scripts', 'MIGRATE.md'),
]);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (/\.(js|ts|mjs|cjs)$/.test(ent.name)) out.push(full);
  }
  return out;
}

let failed = 0;
for (const file of walk(path.join(root, 'api')).concat(walk(path.join(root, 'js')))) {
  if (allowFiles.has(file)) continue;
  const src = fs.readFileSync(file, 'utf8');
  for (const re of banned) {
    if (re.test(src)) {
      console.error(`FAIL ${path.relative(root, file)} matches ${re}`);
      failed += 1;
    }
  }
}

if (failed) {
  process.exit(1);
}
console.log('PASS: no runtime Airtable API usage in api/ or js/');
