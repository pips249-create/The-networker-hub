#!/usr/bin/env node
const {
  normalizeSeedInput,
  isUuid,
  getSeedContact,
} = require('../api/_lib/hubert-match-seed');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

assert(isUuid('550e8400-e29b-41d4-a716-446655440000'), 'uuid ok');
assert(!isUuid('not-a-uuid'), 'uuid reject');

const bad = normalizeSeedInput({ fullName: '', email: 'nope' });
assert(!bad.ok && bad.errors.fullName && bad.errors.email, 'rejects empty name + bad email');

const good = normalizeSeedInput({
  fullName: '  Jane Smith ',
  email: 'Jane@Example.com',
  lookingToMeet: 'Clients, Investors, Clients',
  linkedinUrl: 'linkedin.com/in/jane',
  blurb: 'Fintech founder',
  status: 'active',
});
assert(good.ok, 'accepts valid seed');
assert(good.fields.full_name === 'Jane Smith', 'trims name');
assert(good.fields.email === 'jane@example.com', 'normalises email');
assert(good.fields.looking_to_meet.length === 2, 'dedupes looking-to-meet');
assert(/^https:\/\//.test(good.fields.linkedin_url), 'prefixes linkedin url');

const genericIntent = 'Networking';
assert(genericIntent.length < 25, 'intent min reminder for later slice');
assert(typeof getSeedContact === 'function', 'getSeedContact exported');

console.log('ok — hubert match seed helpers');
