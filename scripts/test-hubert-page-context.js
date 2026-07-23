#!/usr/bin/env node
/**
 * Hubert page contexts for organiser flow and opportunities browse.
 * Usage: node scripts/test-hubert-page-context.js
 */
const {
  ORGANISER_PAGE_KEYS,
  ORGANISER_PAGE_CONTEXT,
  buildPageContextAddendum,
} = require('../api/_lib/hubert-knowledge');

const REQUIRED_KEYS = [
  'event-format',
  'event-edit',
  'event-location',
  'event-tickets',
  'event-review',
  'member-roster',
  'group-edit',
  'organiser-dashboard',
  'guides',
  'opportunities',
];

let failed = 0;

REQUIRED_KEYS.forEach(function (key) {
  if (ORGANISER_PAGE_KEYS.indexOf(key) === -1) {
    failed++;
    console.log('FAIL: missing page context key:', key);
    return;
  }
  if (!ORGANISER_PAGE_CONTEXT[key] || ORGANISER_PAGE_CONTEXT[key].length < 40) {
    failed++;
    console.log('FAIL: empty or short page context for:', key);
  }
});

const oppAddendum = buildPageContextAddendum('opportunities');
if (!/PAGE CONTEXT:/.test(oppAddendum) || !/opportunities/.test(oppAddendum)) {
  failed++;
  console.log('FAIL: opportunities page addendum missing');
}

const dashAddendum = buildPageContextAddendum('organiser-dashboard');
if (!/organiser dashboard/i.test(dashAddendum)) {
  failed++;
  console.log('FAIL: organiser-dashboard addendum missing');
}

console.log(
  failed
    ? failed + ' page-context checks failed'
    : 'All ' + REQUIRED_KEYS.length + ' page contexts present'
);
process.exit(failed ? 1 : 0);
