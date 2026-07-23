#!/usr/bin/env node
/**
 * Ensure organiser / enquiry help does not trigger live opportunity browse.
 * Usage: node scripts/test-hubert-opportunity-intent.js
 */
const { wantsOpportunitySearch } = require('../api/_lib/hubert-opportunities');

const NO_BROWSE = [
  'How do I list a business opportunity on the hub?',
  'I want to list a franchise opportunity',
  'How do I enquire about a franchise?',
  'How do I respond to opportunity enquiries as an organiser?',
  'What are business opportunities?',
  'How do I publish a partnership listing?',
];

const YES_BROWSE = [
  'What franchise opportunities are on the hub?',
  'Help me find a low-investment side hustle opportunity on the hub.',
  'Show me partnership deals',
  'Find franchise opportunities under £10k',
  'Browse opportunities for distributorships',
];

const ORGANISER_SKIP = [
  { q: 'What franchise opportunities are available?', opts: { skipOpportunitySearch: true } },
];

let failed = 0;

NO_BROWSE.forEach(function (q) {
  if (wantsOpportunitySearch(q)) {
    failed++;
    console.log('FAIL (should NOT browse):', q);
  }
});

YES_BROWSE.forEach(function (q) {
  if (!wantsOpportunitySearch(q)) {
    failed++;
    console.log('FAIL (should browse):', q);
  }
});

ORGANISER_SKIP.forEach(function (item) {
  if (wantsOpportunitySearch(item.q, item.opts)) {
    failed++;
    console.log('FAIL (skipOpportunitySearch ignored):', item.q);
  }
});

console.log(
  failed
    ? failed + ' opportunity-intent checks failed'
    : 'All opportunity-intent checks passed (' +
        (NO_BROWSE.length + YES_BROWSE.length + ORGANISER_SKIP.length) +
        ')'
);
process.exit(failed ? 1 : 0);
