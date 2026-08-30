#!/usr/bin/env node
/**
 * Regression: logout fetch must catch Safari TypeError: Load failed before finally,
 * otherwise Sentry reports unhandled rejections (site-nav.js mobile sign-out).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const files = [
  'js/site-nav.js',
  'js/auth.js',
  'js/admin-app.js',
  'js/admin-dashboard.js',
];

let failed = 0;

for (const rel of files) {
  const src = fs.readFileSync(path.join(root, rel), 'utf8');
  const re =
    /fetch\(\s*['"]\/api\/auth\/logout['"][\s\S]*?\)\s*\.catch\(\s*function\s*\(\s*\)\s*\{\s*\}\s*\)\s*\.finally\(/g;
  const matches = src.match(re) || [];
  const logoutCalls = (src.match(/fetch\(\s*['"]\/api\/auth\/logout['"]/g) || []).length;
  if (matches.length !== logoutCalls || logoutCalls < 1) {
    console.error(
      `FAIL ${rel}: expected every logout fetch to use .catch(...).finally(...); found ${matches.length}/${logoutCalls}`
    );
    failed += 1;
  } else {
    console.log(`PASS ${rel}: ${logoutCalls} logout fetch(es) catch before finally`);
  }
}

function failingFetch() {
  return Promise.reject(new TypeError('Load failed'));
}

failingFetch()
  .catch(function () {})
  .finally(function () {})
  .then(function () {
    console.log('PASS runtime: Load failed swallowed; finally still runs');
    if (failed) process.exit(1);
  })
  .catch(function (err) {
    console.error('FAIL runtime', err);
    process.exit(1);
  });
