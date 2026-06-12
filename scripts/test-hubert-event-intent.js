#!/usr/bin/env node
/**
 * Ensure organiser help questions do not trigger live event browse.
 * Usage: node scripts/test-hubert-event-intent.js
 */
const { wantsEventSearch } = require('../api/_lib/hubert-events');

const NO_BROWSE = [
  'What is the difference between an event and a meeting?',
  'My event image is too small — what can I do?',
  'What should I write in my event description?',
  'What do I fill in after choosing the event format?',
  'Can I change the application questions asked?',
  'How can I see who has registered for my event?',
];

const YES_BROWSE = [
  'What events are in Manchester?',
  'Find networking events in Birmingham',
  'Any free events this week?',
  'What networking events are coming up?',
];

let failed = 0;

NO_BROWSE.forEach(function (q) {
  if (wantsEventSearch(q)) {
    failed++;
    console.log('FAIL (should NOT browse):', q);
  }
});

YES_BROWSE.forEach(function (q) {
  if (!wantsEventSearch(q)) {
    failed++;
    console.log('FAIL (should browse):', q);
  }
});

if (wantsEventSearch('What is the difference between an event and a meeting?', { skipEventSearch: true })) {
  failed++;
  console.log('FAIL: skipEventSearch option ignored');
}

console.log(
  failed
    ? failed + ' event-intent checks failed'
    : 'All event-intent checks passed (' + (NO_BROWSE.length + YES_BROWSE.length + 1) + ')'
);
process.exit(failed ? 1 : 0);
