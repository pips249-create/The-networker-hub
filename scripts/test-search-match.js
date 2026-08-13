#!/usr/bin/env node
/**
 * Browse search matching — word-split + light typo tolerance.
 * Run: node scripts/test-search-match.js
 */
const {
  tokenizeSearchQuery,
  haystackMatchesQuery,
  termMatchesHaystack,
  typoVariantTerms,
  searchTermIlikePatterns,
  levenshtein,
} = require('../api/_lib/search-match');

let failed = 0;

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

const hay = 'manchester breakfast networking club city centre';

assert('tokenize empty query', tokenizeSearchQuery('').length === 0);
assert('tokenize splits words', tokenizeSearchQuery('  Manchester Club ').join('|') === 'manchester|club');
assert('tokenize drops and connector', tokenizeSearchQuery('Wine & Dine').join('|') === 'wine|dine');
assert('tokenize and synonym', tokenizeSearchQuery('Wine and Dine').join('|') === 'wine|dine');

assert('exact substring', haystackMatchesQuery(hay, 'manchester'));
assert('partial word', haystackMatchesQuery(hay, 'manch'));
assert('multi-word AND', haystackMatchesQuery(hay, 'networking manchester'));
assert('multi-word order independent', haystackMatchesQuery(hay, 'club breakfast'));
assert('missing word fails', !haystackMatchesQuery(hay, 'networking london'));

assert('ampersand matches and', haystackMatchesQuery('Wine & Dine Networking', 'wine and dine'));
assert('and matches ampersand', haystackMatchesQuery('Wine and Dine Networking', 'wine & dine'));
assert('ampersand multi-word', haystackMatchesQuery('Marks & Spencer Business Club', 'marks spencer'));

assert('typo substitution (edit 1)', haystackMatchesQuery(hay, 'manchaster'));
assert('typo transposition', haystackMatchesQuery(hay, 'mancehster'));
assert('typo extra letter via deletion variant path', termMatchesHaystack('manchesterr', hay));
assert('short typo not fuzzy', !haystackMatchesQuery('bath spa', 'baht'));
assert('short exact still works', haystackMatchesQuery('bath spa', 'bath'));

assert('levenshtein 0', levenshtein('abc', 'abc') === 0);
assert('levenshtein 1 sub', levenshtein('manchester', 'manchaster') === 1);
assert('levenshtein adjacent swap', levenshtein('manchester', 'mancehster') === 1);
assert('levenshtein length gap early exit', levenshtein('ab', 'abcdef') === 2);

const variants = typoVariantTerms('manchestr');
assert('typo variants include deletion prefix of manchester', variants.indexOf('manchest') !== -1);
assert('ilike patterns include exact', searchTermIlikePatterns('London').indexOf('%london%') !== -1);
assert('short term no typo patterns', searchTermIlikePatterns('bath').length === 1);

// Location-style multi-word queries (city + area)
assert(
  'location multi-word',
  haystackMatchesQuery('manchester city centre breakfast club', 'greater manchester') === false
);
assert(
  'location word-split city area',
  haystackMatchesQuery('south manchester networking', 'south manchester')
);
assert(
  'location typo city',
  haystackMatchesQuery('birmingham business centre', 'birminghm')
);

const { matchesSearchCriteria } = require('../api/_lib/opportunity-saved-search-emails');
assert(
  'saved opp search word-split',
  matchesSearchCriteria(
    { title: 'Coffee franchise', desc: 'UK wide', host: 'Bean Co', type: 'franchise', category: 'food', tags: [], meta: [] },
    { q: 'franchise coffee' }
  )
);
assert(
  'saved opp search typo',
  matchesSearchCriteria(
    { title: 'Manchester side hustle', desc: '', host: 'Hub', type: 'side-hustle', category: '', tags: [], meta: [] },
    { q: 'Manchaster' }
  )
);
assert(
  'saved opp location query',
  matchesSearchCriteria(
    {
      title: 'Local franchise',
      desc: '',
      host: 'Hub',
      type: 'franchise',
      locationLabel: 'Leeds city centre',
      tags: [],
      meta: [],
    },
    { locationQuery: 'leeds centre' }
  )
);

const { matchesEventSearchCriteria } = require('../api/_lib/event-saved-search-emails');
assert(
  'saved event search typo',
  matchesEventSearchCriteria(
    { title: 'Manchester Breakfast', description: '', city: 'Manchester', venue_name: '', event_type: 'meeting' },
    { q: 'Manchaster breakfast' }
  )
);

if (failed) {
  console.error('\n' + failed + ' assertion(s) failed');
  process.exit(1);
}
console.log('\nAll search-match checks passed');
