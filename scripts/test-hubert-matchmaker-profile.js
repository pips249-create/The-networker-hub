#!/usr/bin/env node
const {
  LOOKING_TO_MEET_OPTIONS,
  cleanLookingToMeet,
  cleanMatchmakerBlurb,
  parseDiscoverable,
  matchmakerProfileFromAttendee,
  BLURB_MAX,
} = require('../api/_lib/hubert-matchmaker-profile');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

assert(LOOKING_TO_MEET_OPTIONS.includes('Investors'), 'has Investors');
assert(cleanLookingToMeet('Clients, investors, Clients').join(',') === 'Clients,Investors', 'dedupe+canonical');
assert(cleanMatchmakerBlurb('  Hello   world  ') === 'Hello world', 'blurb trim');
assert(cleanMatchmakerBlurb('x'.repeat(BLURB_MAX + 20)).length === BLURB_MAX, 'blurb max');

const on = parseDiscoverable(true, null);
assert(typeof on === 'string' && on.length > 10, 'discoverable on sets timestamp');
assert(parseDiscoverable(false, on) === null, 'discoverable off clears');
assert(parseDiscoverable(undefined, on) === undefined, 'discoverable omit');

const ready = matchmakerProfileFromAttendee({
  matchmaker_blurb: 'Fintech founder',
  looking_to_meet: ['Investors'],
  discoverable_at: on,
});
assert(ready.matchmakerReady === true, 'ready when complete');
assert(ready.discoverable === true, 'discoverable flag');

const missing = matchmakerProfileFromAttendee({});
assert(missing.matchmakerReady === false, 'not ready empty');
assert(missing.matchmakerMissing.includes('headline'), 'missing headline');
assert(missing.matchmakerMissing.includes('lookingToMeet'), 'missing looking');
assert(missing.matchmakerMissing.includes('discoverable'), 'missing discoverable');

console.log('ok — hubert matchmaker profile helpers');
