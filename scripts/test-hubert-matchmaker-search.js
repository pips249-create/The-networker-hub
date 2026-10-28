#!/usr/bin/env node
const {
  shortDisplayName,
  tokenize,
  scoreAgainstQuery,
  eventBoost,
  rankCandidates,
  MAX_SHORTLIST,
} = require('../api/_lib/hubert-matchmaker-search');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

assert(shortDisplayName('Alex Morgan') === 'Alex M.', 'display name');
assert(tokenize('Fintech founders in Manchester').includes('fintech'), 'tokenize');

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
assert(eventBoost(person, ['other']) === 15, 'other-event boost');
assert(eventBoost({ nextEvent: null }, []) === 0, 'no-event boost');

const many = [];
for (let i = 0; i < 8; i++) {
  many.push({
    id: 'member:' + i,
    kind: 'member',
    fullName: 'Person ' + i + ' Test',
    displayName: 'Person T.',
    role: 'Founder',
    company: 'Co',
    industry: 'SaaS',
    professionalRole: 'Founder',
    lookingToMeet: [],
    blurb: 'fintech founder manchester',
    nextEvent: i === 0 ? { eventId: 'evt-1', title: 'Shared event', dateLabel: '1 Jan 2027' } : null,
    onHub: true,
  });
}
const ranked = rankCandidates(many, 'fintech founders manchester', ['evt-1']);
assert(ranked.length === MAX_SHORTLIST, 'caps at 5');
assert(ranked[0].id === 'member:0', 'same-event ranks first');
assert(!ranked.some((m) => m.email || m.linkedinUrl || m.phone), 'no contact fields');

console.log('ok — hubert matchmaker search ranking');
