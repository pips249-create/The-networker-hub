#!/usr/bin/env node
const {
  shortDisplayName,
  tokenize,
  eventSearchTokens,
  extractQueryEventDate,
  resolveEventMatchSelection,
  looksLikeEventAttendeeQuery,
  extractQueryIntent,
  isInternalMatchCandidate,
  scoreAgainstQuery,
  scoreEventTitle,
  eventBoost,
  matchedEventBoost,
  rankCandidates,
  rotateShortlistWindow,
  weekBucket,
  emptyStateCopy,
  MAX_SHORTLIST,
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
  ranked.every((m) => !m.company),
  'company stripped from shortlist (LinkedIn cut-out guard)'
);
assert(ranked.every((m) => m.industry === 'SaaS'), 'industry kept for context');
assert(/Matches what you asked|same upcoming event|Founder/i.test(ranked[0].why || ''), 'why explains fit');

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
assert(/Role fits|Matches what you asked/i.test(adsRanked[0].why || ''), 'why not raw Member');

const eventOnly = rankCandidates([rosie], 'fintech founders manchester', []);
assert(eventOnly.length === 0, 'upcoming event alone does not admit a candidate');

assert(
  isInternalMatchCandidate({
    fullName: 'Rosie McGilvray',
    company: 'The Networker Group Ltd',
  }) === true,
  'Rosie / Networker Group excluded from supply'
);
assert(
  isInternalMatchCandidate({ fullName: 'Alex Advert', company: 'AdCo' }) === false,
  'external member not excluded'
);

console.log('ok — hubert matchmaker search ranking + event attendees');
