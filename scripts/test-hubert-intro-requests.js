#!/usr/bin/env node
/**
 * Unit tests for Hubert intro helpers (no DB).
 */
const {
  validateTopic,
  parseTargetId,
  shortDisplayName,
  firstName,
  formatTitleCompany,
  requesterEmailLabel,
  introDisplayName,
  softIntroStatus,
  publicIntroCard,
  TOPIC_MIN_LEN,
  INTROS_PER_WEEK,
} = require('../api/_lib/hubert-intro-requests');
const {
  createHubertIntroToken,
  verifyHubertIntroToken,
  TOKEN_TYPE,
} = require('../api/_lib/hubert-intro-token');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

assert(TOPIC_MIN_LEN === 25, 'topic min 25');
assert(INTROS_PER_WEEK === 10, '10 intros / week');

assert(shortDisplayName('Alex Morgan') === 'Alex M.', 'short name');
assert(firstName('Alex Morgan') === 'Alex', 'first name');
assert(formatTitleCompany('Founder', 'Acme') === 'Founder · Acme', 'title · company');
assert(formatTitleCompany('Founder', '') === 'Founder', 'title only');
assert(
  requesterEmailLabel({ name: 'Catherine Hill', job_title: 'Founder', company: 'Acme' }) ===
    'Catherine H. (Founder · Acme)',
  'email label with role'
);
assert(requesterEmailLabel({ name: 'Catherine Hill' }) === 'Catherine H.', 'email label name only');
assert(introDisplayName('Alex Morgan', 'pending') === 'Alex M.', 'pending keeps initial');
assert(introDisplayName('Alex Morgan', 'accepted') === 'Alex', 'accepted = first name only');
assert(softIntroStatus('declined').label.indexOf('Didn’t come through') === 0, 'soft decline label');
assert(softIntroStatus('pending').key === 'waiting', 'pending → waiting');
assert(softIntroStatus('accepted').key === 'connected', 'accepted → connected');

const pendingCard = publicIntroCard(
  {
    id: '1',
    status: 'pending',
    topic: 'Compare notes on seed raises in Manchester',
    target_full_name: 'Jordan Lee',
    requester: { name: 'Alex Morgan' },
  },
  { direction: 'outbound' }
);
assert(pendingCard.counterpartDisplayName === 'Jordan L.', 'pending card short name');
assert(pendingCard.connected === false, 'pending not connected');
assert(pendingCard.statusLabel === 'Waiting to hear back', 'pending soft label');

const acceptedCard = publicIntroCard(
  {
    id: '2',
    status: 'accepted',
    topic: 'Compare notes on seed raises in Manchester',
    target_full_name: 'Jordan Lee',
    requester: { name: 'Alex Morgan' },
    accepted_at: '2026-10-29T12:00:00Z',
  },
  { direction: 'outbound' }
);
assert(acceptedCard.displayName === 'Jordan', 'connection shows first name');
assert(acceptedCard.connected === true, 'accepted is connected');
assert(acceptedCard.statusKey === 'connected', 'status key connected');

assert(parseTargetId('member:11111111-1111-1111-1111-111111111111').kind === 'member', 'member id');
assert(parseTargetId('seed:22222222-2222-2222-2222-222222222222').kind === 'seed', 'seed id');
assert(parseTargetId('nope') === null, 'bad id');

let threw = false;
try {
  validateTopic('hi');
} catch (e) {
  threw = e.code === 'topic_too_short' || e.code === 'topic_too_generic';
}
assert(threw, 'rejects short/generic topic');

const okTopic = validateTopic('Looking to compare seed notes ahead of Manchester Founders Breakfast');
assert(okTopic.length >= TOPIC_MIN_LEN, 'accepts real topic');

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-hubert-intro-secret-key';
const token = createHubertIntroToken({ introId: '33333333-3333-3333-3333-333333333333' });
const payload = verifyHubertIntroToken(token);
assert(payload && payload.introId === '33333333-3333-3333-3333-333333333333', 'token round-trip');
assert(TOKEN_TYPE === 'hubert_intro_decision', 'token type');
assert(verifyHubertIntroToken('bad.token.here') === null, 'bad token rejected');

console.log('ok — hubert intro request helpers');
