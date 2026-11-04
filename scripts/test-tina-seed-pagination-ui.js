#!/usr/bin/env node
/**
 * Smoke: Command Centre TINA seed list uses numbered pages (not one long list).
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const adminSrc = fs.readFileSync(path.join(__dirname, '../js/admin-app.js'), 'utf8');
assert.ok(/HUBERT_SEED_PAGE_SIZE\s*=\s*25/.test(adminSrc), 'default page size is 25');
assert.ok(
  adminSrc.includes("adminPaginationHtml(page - 1, totalMatched, pageSize, 'data-hmm-seed-page')"),
  'seed pager uses shared numbered pagination'
);
assert.ok(adminSrc.includes('data-hmm-seed-page'), 'page buttons use data-hmm-seed-page');
assert.ok(adminSrc.includes('Showing '), 'pager shows Showing X–Y of Z');
assert.ok(!adminSrc.includes('hmm-seed-page-prev'), 'prev-only control retired');
assert.ok(!adminSrc.includes('hmm-seed-page-next'), 'next-only control retired');

const seedLib = fs.readFileSync(path.join(__dirname, '../api/_lib/hubert-match-seed.js'), 'utf8');
assert.ok(/parseInt\(opts && \(opts\.pageSize \|\| opts\.limit\), 10\) \|\| 25/.test(seedLib), 'API default 25');
assert.ok(seedLib.includes('totalMatched'), 'API returns totalMatched');
assert.ok(seedLib.includes('totalPages'), 'API returns totalPages');

const route = fs.readFileSync(
  path.join(__dirname, '../api/_lib/routes/admin-hubert-matchmaker.js'),
  'utf8'
);
assert.ok(route.includes("queryParam(req, 'page')"), 'route accepts page');
assert.ok(/pageSize.*\|\| 25/.test(route), 'route default pageSize 25');

const adminHtml = fs.readFileSync(path.join(__dirname, '../admin/index.html'), 'utf8');
assert.ok(/admin-app\.js\?v=20261104seedpage1/.test(adminHtml), 'admin cache-bust bumped');

console.log('ok — TINA seed pagination UI');
