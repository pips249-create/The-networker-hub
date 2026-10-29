#!/usr/bin/env node
/**
 * Guards the Safari-safe dashboard JSON parsing path.
 * Safari throws SyntaxError "The string did not match the expected pattern"
 * when Response.json() is called on empty/non-JSON bodies.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dashPath = path.join(root, 'js/attendee-dashboard.js');
const accountPath = path.join(root, 'account/index.html');
const src = fs.readFileSync(dashPath, 'utf8');
const account = fs.readFileSync(accountPath, 'utf8');

function fail(msg) {
  console.error('FAIL:', msg);
  process.exit(1);
}

if (!/function readResponseJson\s*\(/.test(src)) {
  fail('readResponseJson helper missing');
}
if (!/function showDashboardLoadError\s*\(/.test(src)) {
  fail('showDashboardLoadError helper missing');
}
if (!/return res\.json\(\)\.catch\(/.test(src)) {
  fail('readResponseJson must catch Response.json() failures');
}
if (/const data = await dashRes\.json\(\);/.test(src)) {
  fail('unguarded dashRes.json() still present — Safari empty-body SyntaxError');
}
if (!/const data = await readResponseJson\(dashRes\);/.test(src)) {
  fail('init must parse dashboard via readResponseJson');
}
if (!/if \(!data \|\| !data\.ok\)/.test(src)) {
  fail('init must treat null/non-ok dashboard payloads as load failures');
}
if (!/const data = await readResponseJson\(res\);/.test(src)) {
  fail('reloadDashboard must use readResponseJson');
}
if (!/\}\s*catch\s*\{[\s\S]*showDashboardLoadError\(null\);/.test(src)) {
  fail('init load try-block must catch and showDashboardLoadError');
}
if (!/init\(\)\.catch\(/.test(src)) {
  fail('init() must have a top-level .catch to avoid unhandled rejection');
}
if (!/attendee-dashboard\.js\?v=20261029ticketsnav1/.test(account)) {
  fail('account/index.html cache-buster not bumped for Event tickets nav fix');
}

console.log('ok: attendee dashboard Safari-safe JSON parsing guards present');
