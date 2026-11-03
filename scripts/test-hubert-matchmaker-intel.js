#!/usr/bin/env node
const assert = require('assert');
const {
  parseQueryIntel,
  roleFamilyScore,
  geoScore,
  isExcludedPerson,
  buildSearchSuggestions,
  emptySuggestionCopy,
  canonicalPlace,
  extractPlacesFromText,
  findRoleGroupsInText,
  personPlace,
} = require('../api/_lib/hubert-matchmaker-intel');
const { rankCandidates } = require('../api/_lib/hubert-matchmaker-search');

function person(partial) {
  return Object.assign(
    {
      id: 'member:x',
      kind: 'member',
      fullName: 'Alex Example',
      displayName: 'Alex E.',
      role: '',
      jobTitle: '',
      professionalRole: '',
      company: '',
      industry: '',
      location: '',
      lookingToMeet: [],
      blurb: '',
      nextEvent: null,
      matchedEvent: null,
      onHub: true,
    },
    partial
  );
}

const cioChester = person({
  id: 'member:cio',
  fullName: 'Chris Info',
  displayName: 'Chris I.',
  role: 'CIO',
  jobTitle: 'Chief Information Officer',
  professionalRole: 'CIO',
  location: 'Chester',
  blurb: 'CIO for a UK manufacturer',
});

const headItWarrington = person({
  id: 'member:headit',
  fullName: 'Helen Tech',
  displayName: 'Helen T.',
  role: 'Head of IT',
  jobTitle: 'Head of IT',
  location: 'Warrington',
  blurb: 'Head of IT leading digital',
});

const itManagerChester = person({
  id: 'member:itm',
  fullName: 'Ian Manager',
  displayName: 'Ian M.',
  role: 'IT Manager',
  jobTitle: 'IT Manager',
  location: 'Chester',
  blurb: 'IT Manager',
});

const ctoLiverpool = person({
  id: 'member:cto',
  fullName: 'Casey Tech',
  displayName: 'Casey T.',
  role: 'CTO',
  jobTitle: 'Chief Technology Officer',
  location: 'Liverpool',
  blurb: 'CTO',
});

const recruiterChester = person({
  id: 'member:rec',
  fullName: 'Rita Recruiter',
  displayName: 'Rita R.',
  role: 'Recruiter',
  jobTitle: 'IT Recruiter',
  company: 'Agency Recruiters Ltd',
  location: 'Chester',
  blurb: 'Agency recruiter placing IT Directors',
});

const salesDirector = person({
  id: 'member:sales',
  fullName: 'Sam Sales',
  displayName: 'Sam S.',
  role: 'Sales Director',
  jobTitle: 'Sales Director',
  location: 'Manchester',
  blurb: 'Sales Director',
});

// Synonyms + places + exclusions parse
const intel = parseQueryIntel('IT Directors or Chief Technology Officers in Chester or Liverpool, no agency recruiters');
assert.ok(
  intel.roleGroupIds.includes('it_director') && intel.roleGroupIds.includes('cto'),
  'multi-intent role OR'
);
assert.deepStrictEqual(intel.places.sort(), ['chester', 'liverpool'].sort(), 'multi-intent place OR');
assert.ok(intel.exclusions.includes('recruiter'), 'exclusion parse');
assert.strictEqual(canonicalPlace('MCR'), 'manchester', 'MCR alias');
assert.ok(extractPlacesFromText('fintech in Brum').includes('birmingham'), 'Brum alias');
assert.ok(
  findRoleGroupsInText('Chief Information Officer').some((g) => g.id === 'it_director'),
  'CIO maps to IT Director family'
);

assert.ok(roleFamilyScore(cioChester, intel) >= 20, 'CIO scores for IT Director ask');
assert.ok(roleFamilyScore(ctoLiverpool, intel) >= 20, 'CTO scores for CTO ask');
assert.ok(geoScore(cioChester, intel) >= 30, 'Chester exact geo');
assert.ok(geoScore(headItWarrington, parseQueryIntel('IT Director in Chester')) >= 12, 'Warrington nearby Chester');
assert.ok(isExcludedPerson(recruiterChester, intel), 'recruiter excluded');

// Seniority: IT Manager should not beat IT Director ask without widening
const directorAsk = parseQueryIntel('IT Director in Chester');
assert.ok(roleFamilyScore(itManagerChester, directorAsk) < 0, 'IT Manager below IT Director');
assert.ok(
  roleFamilyScore(itManagerChester, parseQueryIntel('IT Director or senior IT Manager in Chester')) >= 12,
  'widened seniority admits manager'
);

const ranked = rankCandidates(
  [cioChester, headItWarrington, itManagerChester, ctoLiverpool, recruiterChester, salesDirector],
  'IT Director in Chester, no agency recruiters',
  [],
  { disableRotation: true }
);
assert.ok(
  ranked.some((m) => m.id === 'member:cio'),
  'CIO in Chester returned for IT Director in Chester'
);
assert.ok(
  ranked.some((m) => m.id === 'member:headit'),
  'Head of IT in nearby Warrington returned when Chester asked'
);
assert.ok(!ranked.some((m) => m.id === 'member:itm'), 'IT Manager filtered without widen');
assert.ok(!ranked.some((m) => m.id === 'member:rec'), 'recruiter excluded from shortlist');
assert.ok(
  ranked.find((m) => m.id === 'member:cio').placeFit === 'exact',
  'exact placeFit on Chester card'
);
assert.ok(
  ranked.find((m) => m.id === 'member:headit').placeFit === 'nearby',
  'nearby placeFit on Warrington card'
);

const multi = rankCandidates(
  [cioChester, ctoLiverpool, salesDirector],
  'IT Directors or Chief Technology Officers in Chester or Liverpool',
  [],
  { disableRotation: true }
);
assert.ok(multi.some((m) => m.id === 'member:cio'), 'multi OR includes Chester CIO');
assert.ok(multi.some((m) => m.id === 'member:cto'), 'multi OR includes Liverpool CTO');

const md = rankCandidates(
  [
    person({
      id: 'member:md',
      role: 'CEO',
      jobTitle: 'Chief Executive Officer',
      location: 'Birmingham',
      blurb: 'CEO',
    }),
  ],
  'Managing Director in Brum',
  [],
  { disableRotation: true }
);
assert.ok(md.some((m) => m.id === 'member:md'), 'MD synonym + Brum alias');

// Empty-state suggestions when exact place has no role hit but nearby does
const suggestions = buildSearchSuggestions(
  [headItWarrington, ctoLiverpool],
  parseQueryIntel('IT Director in Chester'),
  { limit: 4 }
);
assert.ok(
  suggestions.some((s) => /Warrington/i.test(s.label)),
  'suggests nearby Warrington'
);
const empty = emptySuggestionCopy({
  candidateCount: 5,
  suggestions,
  queryIntel: parseQueryIntel('IT Director in Chester'),
});
assert.ok(empty && /Chester/i.test(empty.title), 'smart empty title cites place');
assert.ok(Array.isArray(empty.suggestions) && empty.suggestions.length, 'smart empty keeps chips');

// Free-text seed locations (“Cardiff / South Wales, UK”) must still geo-match Cardiff asks.
assert.strictEqual(
  personPlace(
    person({
      location: 'Cardiff / South Wales, UK, United Kingdom',
    })
  ),
  'cardiff',
  'extracts Cardiff from free-text seed location'
);
const weddingCardiff = rankCandidates(
  [
    person({
      id: 'seed:zoe',
      kind: 'seed',
      role: 'Wedding Venue & Business Consultant',
      jobTitle: 'Wedding Venue & Business Consultant',
      company: 'Zoe Binning',
      location: 'Cardiff / South Wales, UK, United Kingdom',
      blurb:
        'Provides strategic venue management, eco-friendly business consulting, and commercial expansion advice across the wedding and events sector.',
    }),
  ],
  'I am looking for people in the wedding industry based in or around cardiff',
  [],
  { disableRotation: true }
);
assert.ok(
  weddingCardiff.some((m) => m.id === 'seed:zoe'),
  'wedding + Cardiff ask returns seed with free-text Cardiff location'
);
assert.ok(
  geoScore(
    person({ location: 'Cardiff / South Wales, UK, United Kingdom' }),
    parseQueryIntel('wedding industry in cardiff')
  ) >= 30,
  'Cardiff free-text location scores exact geo'
);

console.log('ok — hubert matchmaker intel (synonyms, geo, exclusions, fallbacks)');
