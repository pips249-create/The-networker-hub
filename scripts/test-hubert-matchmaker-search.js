#!/usr/bin/env node
const {
  shortDisplayName,
  normalizeSearchQuery,
  tokenize,
  expandTokenForms,
  eventSearchTokens,
  extractQueryEventDate,
  resolveEventMatchSelection,
  looksLikeEventAttendeeQuery,
  extractQueryIntent,
  isInternalMatchCandidate,
  queryMentionsNetworkerBrand,
  isNetworkerBrandTeamAsk,
  platformBrandMatchScore,
  scoreAgainstQuery,
  nameMatchScore,
  matchedSearchTokens,
  scoreEventTitle,
  eventBoost,
  matchedEventBoost,
  rankCandidates,
  rotateShortlistWindow,
  shortlistBlurb,
  weekBucket,
  emptyStateCopy,
  mutualLookingScore,
  inferLookingTagsFromPerson,
  MAX_SHORTLIST,
  MIN_TEXT_SCORE,
  SHORTLIST_BLURB_MAX,
  SHORTLIST_ROTATION_POOL,
} = require('../api/_lib/hubert-matchmaker-search');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

assert(shortDisplayName('Alex Morgan') === 'Alex M.', 'display name');
assert(tokenize('Fintech founders in Manchester').includes('fintech'), 'tokenize');
assert(!tokenize('I am looking for people around the UK').includes('uk'), 'drops uk stopword');
assert(!tokenize('I am looking for people around the UK').includes('looking'), 'drops looking stopword');
assert(!tokenize('jamie trickett near york').includes('near'), 'drops near stopword');
assert(!tokenize('based near york').includes('based'), 'drops based stopword');
assert(
  nameMatchScore({ fullName: 'Jamie Trickett' }, tokenize('jamie trickett near york')) >= 40,
  'full name search scores exact'
);
assert(
  nameMatchScore({ fullName: 'Andrea Green' }, tokenize('jamie trickett near york')) === 0,
  'unrelated name scores zero'
);
assert(
  nameMatchScore({ fullName: 'Jamie Smith' }, tokenize('jamie trickett near york')) >= 14,
  'shared first name still scores'
);
assert(expandTokenForms('directors').includes('director'), 'plural → singular');
assert(expandTokenForms('director').includes('directors'), 'singular → plural');
assert(expandTokenForms('companies').includes('company'), 'ies → y');
assert(normalizeSearchQuery('directers in managment') === 'directors in management', 'typo normalize');
assert(tokenize('directers').includes('directors'), 'directers → directors token');
assert(tokenize('fintec founders').includes('fintech'), 'fintec → fintech token');
assert(tokenize('advertizing managers').includes('advertising'), 'advertizing → advertising');
assert(tokenize('MD in SaaS').includes('md'), 'keeps MD acronym');
assert(expandTokenForms('md').includes('managing director'), 'MD expands to managing director');
assert(tokenize('HR directors').includes('hr'), 'keeps HR acronym');

const evolutionQ = 'Who attended evolution virtual networking this morning';
assert(looksLikeEventAttendeeQuery(evolutionQ) === true, 'event-intent query');
assert(looksLikeEventAttendeeQuery('fintech founders in Manchester') === false, 'role query not event-intent');
const evTokens = eventSearchTokens(evolutionQ);
assert(evTokens.includes('evolution'), 'keeps evolution');
assert(!evTokens.includes('virtual'), 'drops generic virtual');
assert(!evTokens.includes('networking'), 'drops generic networking');
assert(!evTokens.includes('attended'), 'drops attended stopword');
assert(!evTokens.includes('morning'), 'drops morning stopword');
assert(scoreEventTitle('Evolution Virtual Networking', evTokens) >= 3, 'event title scores');
assert(
  scoreEventTitle('Multi-Club Virtual Networking for Women in Business', evTokens) === 0,
  'generic virtual networking must not steal Evolution asks'
);

const datedQ =
  'people who have attended evolution virtual networking on Thursday 29th October 2026';
const datedTokens = eventSearchTokens(datedQ);
assert(datedTokens.includes('evolution'), 'dated ask keeps evolution');
assert(!datedTokens.includes('thursday'), 'drops weekday');
assert(!datedTokens.includes('october'), 'drops month');
assert(!datedTokens.includes('2026'), 'drops year');
assert(
  scoreEventTitle('Multi-Club Virtual Networking for Women in Business', datedTokens) === 0,
  'dated Evolution ask does not match Multi-Club'
);
const hint = extractQueryEventDate(datedQ);
assert(hint && hint.getUTCFullYear() === 2026, 'parses year');
assert(hint && hint.getUTCMonth() === 9, 'parses October');
assert(hint && hint.getUTCDate() === 29, 'parses 29th');

const closeScores = resolveEventMatchSelection([
  {
    event: { id: '1', title: 'Evolution Virtual Networking', starts_at: '2026-10-29T18:00:00Z' },
    titleScore: 3,
    score: 43,
  },
  {
    event: { id: '2', title: 'Evolution After Hours', starts_at: '2026-10-28T18:00:00Z' },
    titleScore: 3,
    score: 35,
  },
]);
assert(closeScores.needsEventPick === true, 'close scores need confirm pick');
assert(closeScores.matchedEvents.length === 0, 'do not auto-load ambiguous rooms');
assert(closeScores.eventCandidates.length === 2, 'candidates offered for pick');

const clearWin = resolveEventMatchSelection([
  {
    event: { id: '1', title: 'Evolution Virtual Networking', starts_at: '2026-10-29T18:00:00Z' },
    titleScore: 3,
    score: 43,
  },
  {
    event: { id: '2', title: 'Evolution After Hours', starts_at: '2026-09-01T18:00:00Z' },
    titleScore: 3,
    score: 11,
  },
]);
assert(clearWin.needsEventPick === false, 'clear winner auto-selects');
assert(clearWin.matchedEvents[0].id === '1', 'top event selected');

const pickEmpty = emptyStateCopy({
  eventQuery: true,
  needsEventPick: true,
  matchedEvents: [],
  eventCandidates: [{ title: 'Evolution Virtual Networking' }],
  eventAttendeeCount: 0,
  candidateCount: 0,
});
assert(/Which event/i.test(pickEmpty.title), 'empty copy asks which event');

const person = {
  fullName: 'Alex Morgan',
  displayName: 'Alex M.',
  company: 'Northbridge Labs',
  industry: 'SaaS',
  professionalRole: 'Founder',
  lookingToMeet: ['Clients'],
  blurb: 'B2B fintech founder',
  nextEvent: { eventId: 'evt-1', title: 'Manchester Founders Breakfast', dateLabel: '12 Nov 2026' },
  onHub: true,
  kind: 'member',
  id: 'member:1',
  role: 'Founder',
};

assert(scoreAgainstQuery(person, tokenize('fintech founder')) >= 3, 'text score');
assert(eventBoost(person, ['evt-1']) === 40, 'same-event boost');
assert(eventBoost(person, ['other']) === 12, 'other-event boost');
assert(eventBoost({ nextEvent: null }, []) === 0, 'no-event boost');

const many = [];
for (let i = 0; i < 8; i++) {
  many.push({
    id: 'member:' + i,
    kind: 'member',
    fullName: 'Person ' + i + ' Test',
    displayName: 'Person T.',
    role: 'Founder',
    company: 'Secret Co ' + i,
    industry: 'SaaS',
    professionalRole: 'Founder',
    lookingToMeet: [],
    blurb: 'fintech founder manchester',
    nextEvent: i === 0 ? { eventId: 'evt-1', title: 'Shared event', dateLabel: '1 Jan 2027' } : null,
    onHub: true,
  });
}
const ranked = rankCandidates(many, 'fintech founders manchester', ['evt-1'], {
  disableRotation: true,
});
assert(ranked.length === MAX_SHORTLIST, 'caps at 5');
assert(ranked[0].id === 'member:0', 'same-event ranks first without rotation');
assert(!ranked.some((m) => m.email || m.linkedinUrl || m.phone), 'no contact fields');
assert(
  ranked.every((m) => !m.displayName && !m.fullName),
  'name stripped from shortlist (LinkedIn cut-out guard)'
);
assert(
  ranked.every((m) => typeof m.company === 'string'),
  'company field returned on shortlist (names are hidden)'
);
assert(
  ranked.some((m) => m.company && /Secret Co/.test(m.company)),
  'company visible on shortlist cards without names'
);
assert(ranked.every((m) => m.industry === 'SaaS'), 'industry kept for context');
assert(
  ranked.every((m) => m.blurb === 'fintech founder manchester'),
  'shortlist includes Hubert blurb for intro decisions'
);
assert(shortlistBlurb({ blurb: '  Hello   world again  ' }) === 'Hello world again', 'shortlist blurb trims');
assert(
  shortlistBlurb({ blurb: '', lookingToMeet: ['Clients', 'Investors'] }) ===
    'Looking to meet Clients, Investors',
  'shortlist blurb falls back to looking-to-meet'
);
assert(shortlistBlurb({ blurb: '', lookingToMeet: [] }) === '', 'empty blurb stays empty');
assert(
  !/Richard|Frazer|Top Networking/i.test(
    shortlistBlurb({
      fullName: 'Richard Frazer',
      company: 'Top Networking Clubs',
      blurb:
        'Richard Frazer runs Top Networking Clubs helping business owners meet peers across the UK and beyond with structured introductions.',
    })
  ),
  'shortlist blurb strips name + company (LinkedIn cut-out guard)'
);
assert(
  !/Director of where|Top Networking|networking/i.test(
    shortlistBlurb({
      fullName: 'Richard Frazer',
      company: 'Top Networking Clubs',
      role: 'Director',
      lookingToMeet: ['Clients'],
      blurb:
        'Director of Top Networking Clubs where we are empowering SME business owners to grow through structured networking & strategic collaboration.',
    })
  ),
  'mangled “Director of where…” blurbs fall back instead of leaking'
);
assert(
  shortlistBlurb({
    fullName: 'Richard Frazer',
    company: 'Top Networking Clubs',
    role: 'Director',
    lookingToMeet: ['Clients'],
    blurb:
      'Director of Top Networking Clubs where we are empowering SME business owners to grow through structured networking & strategic collaboration.',
  }) === 'Looking to meet Clients',
  'broken privacy strip falls back to looking-to-meet'
);
assert(
  !/Senn Studio|Muna/i.test(
    shortlistBlurb({
      fullName: 'Muna Hassan',
      company: 'The Senn Studio',
      role: 'Director',
      lookingToMeet: ['Clients'],
      blurb:
        'I founded The Senn Studio to help business owners be known before they are needed, and to build the systems that make growth feel calm.',
    })
  ),
  'Muna company/name stripped from shortlist blurb'
);
assert(
  /help business owners/i.test(
    shortlistBlurb({
      fullName: 'Muna Hassan',
      company: 'The Senn Studio',
      role: 'Director',
      lookingToMeet: ['Clients'],
      blurb:
        'I founded The Senn Studio to help business owners be known before they are needed, and to build the systems that make growth feel calm.',
    })
  ),
  'Muna blurb keeps the real description after company strip'
);
assert(
  !/\bfounded\s+(?:the\s+)?to\b|\bthe\s+to\s+help\b/i.test(
    shortlistBlurb({
      fullName: 'Muna Hassan',
      company: 'The Senn Studio',
      role: 'Director',
      blurb: 'I founded The Senn Studio to help business owners be known before they are needed.',
    })
  ),
  'Muna blurb is not mangled to “founded The to help”'
);
assert(
  shortlistBlurb({
    fullName: 'Richard Frazer',
    company: 'Top Networking Clubs',
    role: 'Director',
    lookingToMeet: [],
    blurb:
      'Director of Top Networking Clubs where we are empowering SME business owners to grow.',
  }) === 'Director at Top Networking Clubs',
  'empty looking-to-meet falls back to role at company'
);
assert(
  shortlistBlurb({
    fullName: 'Lee Kaznowski',
    company: 'Ascentis Accountants',
    industry: 'Accountancy and Finance',
    lookingToMeet: [],
    blurb: '',
  }) === 'Accountancy and Finance — open to intros',
  'seed with company+industry gets a useful blurb'
);
assert(
  require('../api/_lib/hubert-matchmaker-search').toPublicShortlistCard({
    person: {
      id: 'seed:lee',
      kind: 'seed',
      fullName: 'Lee Kaznowski',
      company: 'Ascentis Accountants',
      industry: 'Accountancy and Finance',
      role: '',
      lookingToMeet: [],
      blurb: '',
      onHub: false,
    },
    total: 10,
    geoScore: 0,
  }).company === 'Ascentis Accountants',
  'public card includes company'
);
assert(
  shortlistBlurb({
    fullName: 'Alex Morgan',
    company: 'Northbridge Labs',
    blurb: 'x'.repeat(SHORTLIST_BLURB_MAX + 40),
  }).length <= SHORTLIST_BLURB_MAX + 1,
  'shortlist blurb stays short'
);
const richardCard = rankCandidates(
  [
    {
      id: 'seed:richard-card',
      kind: 'seed',
      fullName: 'Richard Frazer',
      displayName: 'Richard F.',
      role: 'Director',
      company: 'Top Networking Clubs',
      jobTitle: 'Director',
      industry: 'networking',
      professionalRole: 'Director',
      lookingToMeet: ['Clients'],
      blurb:
        'Director of Top Networking Clubs where we are empowering SME business owners to grow through structured networking & strategic collaboration.',
      nextEvent: null,
      matchedEvent: null,
      onHub: false,
    },
  ],
  'directors',
  [],
  { disableRotation: true }
)[0];
assert(richardCard && richardCard.industry === '', 'networking industry hidden on card');
assert(richardCard.blurb === 'Looking to meet Clients', 'Richard card uses safe teaser');
assert(!/where we are|Top Networking|Frazer/i.test(richardCard.blurb || ''), 'Richard card blurb not LinkedInable');
assert(
  /Matches your search|Mentioned in your search|Exact|Founder|same upcoming event|Overlaps with words/i.test(
    ranked[0].why || ''
  ),
  'why explains fit'
);

const jamieAsk = 'I am looking to meet jamie trickett who is based near york';
const jamiePool = [
  {
    id: 'seed:andrea',
    kind: 'seed',
    fullName: 'Andrea Green',
    displayName: 'Andrea G.',
    role: 'Joiner Carpenter',
    company: '',
    industry: 'Construction',
    professionalRole: 'Joiner',
    location: '',
    lookingToMeet: ['Clients'],
    blurb: 'A joiner carpenter who is based in Pocklington, near York.',
    nextEvent: null,
    matchedEvent: null,
    onHub: false,
  },
  {
    id: 'member:jamie',
    kind: 'member',
    fullName: 'Jamie Trickett',
    displayName: 'Jamie T.',
    role: 'Networker',
    company: '',
    industry: '',
    professionalRole: 'Networker',
    location: 'York',
    lookingToMeet: [],
    blurb: '',
    nextEvent: null,
    matchedEvent: null,
    onHub: true,
  },
];
const jamieRanked = rankCandidates(jamiePool, jamieAsk, [], { disableRotation: true });
assert(jamieRanked[0] && jamieRanked[0].id === 'member:jamie', 'name search ranks Jamie first');
assert(/name/i.test(jamieRanked[0].why || ''), 'Jamie why cites name match');
assert(
  !/Matches what you asked TINA for/i.test(jamieRanked[0].why || ''),
  'Jamie why is not the generic fallback'
);
const andrea = jamieRanked.find((m) => m.id === 'seed:andrea');
assert(andrea, 'Andrea still surfaces on York overlap');
assert(/York|york|search/i.test(andrea.why || ''), 'Andrea why cites York / search parts');

const wide = [];
for (let i = 0; i < 12; i++) {
  wide.push({ person: { id: 'm' + i, displayName: 'P' + i }, total: 100 - i });
}
const windowA = rotateShortlistWindow(wide, {
  rotationKey: 'user-a',
  nowMs: 0,
  query: 'fintech',
});
const windowB = rotateShortlistWindow(wide, {
  rotationKey: 'user-a',
  nowMs: 7 * 24 * 60 * 60 * 1000,
  query: 'fintech',
});
assert(windowA.length === MAX_SHORTLIST, 'rotation window size');
assert(SHORTLIST_ROTATION_POOL >= MAX_SHORTLIST, 'pool wider than shortlist');
assert(
  JSON.stringify(windowA.map((r) => r.person.id)) !==
    JSON.stringify(windowB.map((r) => r.person.id)),
  'weekly rotation changes the shortlist window'
);
assert(typeof weekBucket(Date.now()) === 'number', 'week bucket');
const noRotate = rotateShortlistWindow(wide, { disableRotation: true });
assert(noRotate[0].person.id === 'm0', 'disableRotation keeps top rank');

const attendeeOnly = {
  id: 'member:att',
  kind: 'member',
  fullName: 'Jordan Lee',
  displayName: 'Jordan L.',
  role: 'Operator',
  company: 'Acme',
  industry: '',
  professionalRole: '',
  lookingToMeet: [],
  blurb: '',
  nextEvent: null,
  matchedEvent: {
    eventId: 'evt-evo',
    title: 'Evolution Virtual Networking',
    dateLabel: '29 Oct 2026',
  },
  onHub: true,
};
assert(matchedEventBoost(attendeeOnly) === 55, 'matched-event boost');
const evoRanked = rankCandidates([attendeeOnly], evolutionQ, []);
assert(evoRanked.length === 1, 'event attendee returns without profile keywords');
assert(evoRanked[0].id === 'member:att', 'event attendee id');
assert(/Booked for Evolution/i.test(evoRanked[0].why || ''), 'why cites event');
assert(evoRanked[0].nextEvent && evoRanked[0].nextEvent.title.indexOf('Evolution') === 0, 'surfaces matched event');

const emptyEvent = emptyStateCopy({
  eventQuery: true,
  matchedEvents: [{ title: 'Evolution Virtual Networking' }],
  eventAttendeeCount: 0,
  candidateCount: 2,
});
assert(/No bookings/i.test(emptyEvent.title), 'empty: matched event, no bookings');

const noEvent = emptyStateCopy({
  eventQuery: true,
  matchedEvents: [],
  eventAttendeeCount: 0,
  candidateCount: 0,
});
assert(/couldn’t match that event/i.test(noEvent.title), 'empty: no event match');

const thinPool = emptyStateCopy({ eventQuery: false, candidateCount: 0 });
assert(/still thin/i.test(thinPool.text), 'empty: thin pool');
const selfOnly = emptyStateCopy({
  eventQuery: false,
  candidateCount: 0,
  requesterDiscoverable: true,
});
assert(/Nobody else is in the pool/i.test(selfOnly.title), 'empty: self excluded from own search');
assert(/never shows you your own profile/i.test(selfOnly.text), 'empty explains self-exclusion');

const adsQ =
  'I am looking for employees around the UK who might be interested in advertising on my site';
assert(extractQueryIntent(adsQ).wantEmployees === true, 'employees intent');
const tokensAds = tokenize(adsQ);
assert(tokensAds.includes('employees'), 'keeps employees');
assert(tokensAds.includes('advertising'), 'keeps advertising');
assert(!tokensAds.includes('uk'), 'drops uk for ads query');

const rosie = {
  id: 'member:rosie',
  kind: 'member',
  fullName: 'Rosie McGilvray',
  displayName: 'Rosie M.',
  role: 'founder',
  company: 'The Networker Group Ltd',
  jobTitle: 'founder',
  industry: '',
  professionalRole: 'founder',
  lookingToMeet: ['Partners'],
  blurb: 'Building The Networker UK',
  nextEvent: {
    title: 'The Business Show London',
    dateLabel: '11 Nov 2026',
    eventId: 'e1',
  },
  matchedEvent: null,
  onHub: true,
  why: 'Member',
};
const marketer = {
  id: 'member:marketer',
  kind: 'member',
  fullName: 'Alex Advert',
  displayName: 'Alex A.',
  role: 'Marketing manager',
  company: 'AdCo',
  jobTitle: 'Marketing manager',
  industry: 'Advertising',
  professionalRole: 'Employee',
  lookingToMeet: ['Clients'],
  blurb: 'UK employees interested in advertising and media buying for websites',
  nextEvent: null,
  matchedEvent: null,
  onHub: true,
  why: 'Member',
};
const adsRanked = rankCandidates([rosie, marketer], adsQ, []);
assert(
  !adsRanked.some((m) => m.id === 'member:rosie'),
  'founder with upcoming event must not match employees/advertising ask'
);
assert(adsRanked.length === 1 && adsRanked[0].id === 'member:marketer', 'relevant marketer ranks');
assert(
  /Role fits|Matches your search|Mentioned in your search|Title match|Overlaps with words|Exact/i.test(
    adsRanked[0].why || ''
  ),
  'why not raw Member'
);
assert(!/^Member$/i.test(adsRanked[0].why || ''), 'why is not the raw Member stub');

const eventOnlyPerson = {
  id: 'member:event-only',
  kind: 'member',
  fullName: 'Eve Only',
  displayName: 'Eve O.',
  role: 'Consultant',
  company: 'OtherCo',
  jobTitle: 'Consultant',
  industry: 'Legal',
  professionalRole: 'Consultant',
  lookingToMeet: [],
  blurb: 'General consulting',
  nextEvent: {
    title: 'Random Breakfast Club',
    dateLabel: '11 Nov 2026',
    eventId: 'e-random',
  },
  matchedEvent: null,
  onHub: true,
};
const eventOnly = rankCandidates([eventOnlyPerson], 'fintech founders manchester', []);
assert(eventOnly.length === 0, 'upcoming event alone does not admit a candidate');

assert(
  isInternalMatchCandidate({
    fullName: 'Rosie McGilvray',
    company: 'The Networker Group Ltd',
  }) === true,
  'Rosie / Networker Group recognised as Hub team'
);
assert(
  isInternalMatchCandidate({ fullName: 'Alex Advert', company: 'AdCo' }) === false,
  'external member not treated as Hub team'
);
assert(
  queryMentionsNetworkerBrand('The networker UK directors') === true,
  'detects Networker UK brand ask'
);
assert(queryMentionsNetworkerBrand('fintech directors') === false, 'plain directors is not brand ask');

// Plural role asks must match singular job titles (Jamie: “directors” → Director).
const salesDirector = {
  id: 'member:dir1',
  kind: 'member',
  fullName: 'Sam Director',
  displayName: 'Sam D.',
  role: 'Sales Director',
  company: 'DirCo',
  jobTitle: 'Sales Director',
  industry: 'SaaS',
  professionalRole: 'Director',
  lookingToMeet: ['Clients'],
  blurb: 'B2B sales director helping SaaS teams',
  nextEvent: null,
  matchedEvent: null,
  onHub: true,
};
const marketingManager = {
  id: 'member:mgr1',
  kind: 'member',
  fullName: 'Mo Manager',
  displayName: 'Mo M.',
  role: 'Marketing manager',
  company: 'MgrCo',
  jobTitle: 'Marketing manager',
  industry: 'Media',
  professionalRole: 'Manager',
  lookingToMeet: ['Partners'],
  blurb: 'Brand and demand gen',
  nextEvent: null,
  matchedEvent: null,
  onHub: true,
};
assert(
  scoreAgainstQuery(salesDirector, tokenize('directors')) >= MIN_TEXT_SCORE,
  'directors scores against Director title'
);
const directorsRanked = rankCandidates(
  [salesDirector, marketingManager, rosie],
  'directors',
  [],
  { disableRotation: true }
);
assert(
  directorsRanked.some((m) => m.id === 'member:dir1'),
  'plural directors returns Sales Director'
);
assert(
  !directorsRanked.some((m) => m.id === 'member:mgr1'),
  'managers do not match bare directors ask'
);
const foundersPlural = rankCandidates(
  [
    {
      id: 'member:f1',
      kind: 'member',
      fullName: 'Fran Founder',
      displayName: 'Fran F.',
      role: 'Founder',
      company: 'StartCo',
      jobTitle: 'Founder',
      industry: 'Fintech',
      professionalRole: 'Founder',
      lookingToMeet: [],
      blurb: 'fintech founder',
      nextEvent: null,
      matchedEvent: null,
      onHub: true,
    },
  ],
  'founders',
  [],
  { disableRotation: true }
);
assert(foundersPlural.length === 1, 'plural founders matches Founder title');

// Jamie: “The networker UK directors” should surface Rosie & Catherine (Hub team).
const catherine = {
  id: 'member:catherine',
  kind: 'member',
  fullName: 'Catherine Hancher',
  displayName: 'Catherine H.',
  role: 'Director',
  company: 'The Networker Group Ltd',
  jobTitle: 'Director',
  industry: '',
  professionalRole: 'Director',
  lookingToMeet: ['Partners'],
  blurb: 'Operations director for The Networker UK',
  nextEvent: null,
  matchedEvent: null,
  onHub: true,
};
assert(
  platformBrandMatchScore(rosie, 'The networker UK directors') >= 18,
  'Rosie scores on Networker UK directors ask'
);
assert(
  platformBrandMatchScore(catherine, 'The networker UK directors') >= 18,
  'Catherine scores on Networker UK directors ask'
);
assert(
  platformBrandMatchScore(salesDirector, 'The networker UK directors') === 0,
  'external director gets no Hub-team brand boost'
);
const networkerDirectors = rankCandidates(
  [rosie, catherine, salesDirector],
  'The networker UK directors',
  [],
  { disableRotation: true }
);
assert(
  networkerDirectors.some((m) => m.id === 'member:rosie'),
  'Rosie surfaces for The networker UK directors'
);
assert(
  networkerDirectors.some((m) => m.id === 'member:catherine'),
  'Catherine surfaces for The networker UK directors'
);
assert(
  networkerDirectors.some((m) => /Networker UK team/i.test(m.why || '')),
  'why explains Hub team match'
);
assert(
  !/Rosie|Catherine|McGilvray|Hancher|Networker (?:UK|Group)/i.test(
    networkerDirectors.map((m) => m.blurb || '').join(' ')
  ),
  'Hub team shortlist blurbs stay anonymous'
);
const bareDirectors = rankCandidates([rosie, salesDirector], 'directors', [], {
  disableRotation: true,
});
assert(
  platformBrandMatchScore(rosie, 'directors') === 0,
  'bare directors ask gives Hub team no brand boost'
);
assert(
  !bareDirectors.some((m) => m.id === 'member:rosie'),
  'Rosie founder does not match bare directors without Networker UK brand'
);
assert(
  bareDirectors.some((m) => m.id === 'member:dir1'),
  'ordinary Sales Director still matches bare directors'
);

// “director of The networker UK” must not return random Director seeds.
const connect98 = {
  id: 'seed:connect98',
  kind: 'seed',
  fullName: 'Pat Example',
  displayName: 'Pat E.',
  role: 'Director / Owner',
  jobTitle: 'Director / Owner',
  company: 'Connect 98',
  industry: '',
  professionalRole: 'Director',
  lookingToMeet: [],
  blurb: 'We help businesses communicate',
  nextEvent: null,
  matchedEvent: null,
  onHub: false,
};
const ofNetworkerAsk = 'looking for the director of The networker UK';
assert(queryMentionsNetworkerBrand(ofNetworkerAsk) === true, 'of Networker UK is brand ask');
assert(isNetworkerBrandTeamAsk(ofNetworkerAsk) === true, 'director of Networker UK is team ask');
assert(
  isInternalMatchCandidate({ fullName: 'Alex Ops', company: 'Networker Group' }) === true,
  'Networker Group short company form counts as Hub team'
);
const ofNetworkerRanked = rankCandidates(
  [rosie, catherine, connect98, salesDirector],
  ofNetworkerAsk,
  [],
  { disableRotation: true }
);
assert(
  ofNetworkerRanked.some((m) => m.id === 'member:rosie'),
  'Rosie surfaces for director of The networker UK'
);
assert(
  ofNetworkerRanked.some((m) => m.id === 'member:catherine'),
  'Catherine surfaces for director of The networker UK'
);
assert(
  !ofNetworkerRanked.some((m) => m.id === 'seed:connect98' || m.id === 'member:dir1'),
  'external Directors excluded from Networker UK team ask'
);

// Spelling / acronym resilience for common role asks.
assert(
  rankCandidates([salesDirector], 'directers', [], { disableRotation: true }).some(
    (m) => m.id === 'member:dir1'
  ),
  'typo directers still matches Sales Director'
);
const managingDirector = {
  id: 'member:md1',
  kind: 'member',
  fullName: 'Morgan Lead',
  displayName: 'Morgan L.',
  role: 'Managing Director',
  company: 'LeadCo',
  jobTitle: 'Managing Director',
  industry: 'SaaS',
  professionalRole: 'Managing Director',
  lookingToMeet: [],
  blurb: 'Managing Director of a B2B SaaS firm',
  nextEvent: null,
  matchedEvent: null,
  onHub: true,
};
assert(
  rankCandidates([managingDirector, salesDirector], 'MD', [], { disableRotation: true }).some(
    (m) => m.id === 'member:md1'
  ),
  'MD acronym matches Managing Director'
);
assert(
  !rankCandidates([managingDirector, salesDirector], 'MD', [], { disableRotation: true }).some(
    (m) => m.id === 'member:dir1'
  ),
  'MD acronym does not match every Director title'
);
assert(
  rankCandidates([marketingManager], 'marketing managgers', [], { disableRotation: true }).some(
    (m) => m.id === 'member:mgr1'
  ),
  'typo managgers still matches Marketing manager'
);

// Fit labels + mutual looking-to-meet (“open to someone like you”).
const founderRequester = {
  lookingToMeet: ['Investors', 'Mentors'],
  professionalRole: 'Founder',
  jobTitle: 'Founder',
  role: 'Founder',
  blurb: 'Fintech founder raising seed',
};
assert(
  inferLookingTagsFromPerson(founderRequester).includes('co-founders'),
  'founder requester inferred as co-founders tag'
);
const investorOpenToFounders = {
  id: 'member:angel1',
  kind: 'member',
  fullName: 'Alex Angel',
  displayName: 'Alex A.',
  role: 'Angel Investor',
  company: 'Angel Desk',
  jobTitle: 'Angel Investor',
  professionalRole: 'Investor',
  lookingToMeet: ['Co-founders'],
  blurb: 'Angel investor backing early-stage founders',
  location: 'Leeds',
  nextEvent: null,
  matchedEvent: null,
  onHub: true,
};
const mutual = mutualLookingScore(investorOpenToFounders, founderRequester);
assert(mutual.theyWantYou === true, 'investor open to co-founders wants founder requester');
assert(mutual.youWantThem === true, 'founder looking for investors wants angel');
assert(mutual.score >= 20, 'mutual looking score is meaningful');

const mutualRanked = rankCandidates(
  [investorOpenToFounders, salesDirector],
  'investors in Leeds',
  [],
  { disableRotation: true, requester: founderRequester }
);
const angelCard = mutualRanked.find((m) => m.id === 'member:angel1');
assert(angelCard, 'angel surfaces for investors ask');
assert(
  Array.isArray(angelCard.fitLabels) &&
    angelCard.fitLabels.some((f) => f.key === 'mutual' || f.key === 'like_you'),
  'fit label shows mutual / open to someone like you'
);
assert(
  /Mutual fit|Open to meeting someone like you/i.test(angelCard.why || ''),
  'why explains mutual looking-to-meet'
);

const placeRoleCard = rankCandidates(
  [
    {
      id: 'member:cio-leeds',
      kind: 'member',
      fullName: 'Casey Ops',
      displayName: 'Casey O.',
      role: 'CIO',
      jobTitle: 'Chief Information Officer',
      professionalRole: 'CIO',
      company: 'TechCo',
      lookingToMeet: [],
      blurb: 'CIO for a Yorkshire manufacturer',
      location: 'Leeds',
      onHub: true,
    },
  ],
  'IT Director in Leeds',
  [],
  { disableRotation: true }
)[0];
assert(placeRoleCard, 'CIO in Leeds returned');
assert(
  placeRoleCard.fitLabels.some((f) => f.key === 'exact_place'),
  'Exact place fit label'
);
assert(
  placeRoleCard.fitLabels.some((f) => f.key === 'role_match' || f.key === 'related_role'),
  'Role / related role fit label'
);
assert(placeRoleCard.placeFit === 'exact', 'placeFit exact retained');

console.log('ok — hubert matchmaker search ranking + event attendees');
