#!/usr/bin/env node
const {
  LOOKING_TO_MEET_OPTIONS,
  cleanLookingToMeet,
  cleanMatchmakerBlurb,
  parseDiscoverable,
  suggestMatchmakerBlurb,
  matchmakerProfileFromAttendee,
  assertMatchmakerReady,
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

assert(
  suggestMatchmakerBlurb({ job_title: 'Founder', company: 'Northbridge' }) === 'Founder at Northbridge',
  'suggest from job+company'
);
assert(suggestMatchmakerBlurb({ professional_role: 'Investor' }) === 'Investor', 'suggest role only');

const ready = matchmakerProfileFromAttendee({
  matchmaker_blurb: 'Fintech founder',
  looking_to_meet: ['Investors'],
  discoverable_at: on,
});
assert(ready.matchmakerReady === true, 'ready when complete');
assert(ready.discoverable === true, 'discoverable flag');

const missing = matchmakerProfileFromAttendee({
  job_title: 'Founder',
  company: 'Acme',
});
assert(missing.matchmakerReady === false, 'not ready without opt-in');
assert(missing.discoverable === false, 'never auto discoverable');
assert(missing.suggestedBlurb === 'Founder at Acme', 'suggested blurb');
assert(missing.matchmakerBlurb === '', 'saved blurb empty');
assert(missing.matchmakerBlurbPrefill === 'Founder at Acme', 'prefill uses suggestion');
assert(missing.matchmakerMissing.includes('headline'), 'missing headline until saved');
assert(missing.matchmakerMissing.includes('lookingToMeet'), 'missing looking');
assert(missing.matchmakerMissing.includes('discoverable'), 'missing discoverable');
assert(
  require('../api/_lib/hubert-matchmaker-profile').normalizeLookingToMeetList('{Clients,Investors}').join(',') ===
    'Clients,Investors',
  'normalizes pg array text'
);

let threw = false;
try {
  assertMatchmakerReady(missing);
} catch (e) {
  threw = e.code === 'profile_incomplete';
}
assert(threw, 'assertMatchmakerReady throws when incomplete');
assertMatchmakerReady(ready);

console.log('ok — hubert matchmaker profile helpers');
