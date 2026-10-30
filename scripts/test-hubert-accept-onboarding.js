#!/usr/bin/env node
/**
 * Unit tests for Hubert Accept 2-tap onboarding (no DB).
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  ACCEPT_INDUSTRY_OPTIONS,
  acceptOnboardingOptions,
  parseAcceptOnboarding,
} = require('../api/_lib/hubert-accept-onboarding');
const { LOOKING_TO_MEET_OPTIONS } = require('../api/_lib/hubert-matchmaker-profile');

assert.ok(ACCEPT_INDUSTRY_OPTIONS.length >= 10, 'industry options present');
assert.ok(!ACCEPT_INDUSTRY_OPTIONS.includes('Other'), 'bare Other excluded from Accept list');

const opts = acceptOnboardingOptions();
assert.deepStrictEqual(opts.lookingToMeetOptions, LOOKING_TO_MEET_OPTIONS, 'looking options shared');
assert.ok(opts.industryOptions.includes('IT, Software & Technology'), 'tech industry listed');

const parsed = parseAcceptOnboarding({
  industry: 'IT, Software & Technology',
  lookingToMeet: ['Clients', 'Investors'],
});
assert.strictEqual(parsed.industry, 'IT, Software & Technology');
assert.deepStrictEqual(parsed.lookingToMeet, ['Clients', 'Investors']);

let threw = false;
try {
  parseAcceptOnboarding({ industry: '', lookingToMeet: ['Clients'] });
} catch (e) {
  threw = e.code === 'accept_industry_required';
}
assert.ok(threw, 'industry required');

threw = false;
try {
  parseAcceptOnboarding({ industry: 'Legal', lookingToMeet: [] });
} catch (e) {
  threw = e.code === 'accept_looking_required';
}
assert.ok(threw, 'looking required');

assert.ok(
  typeof require('../api/_lib/hubert-accept-onboarding').resolveAcceptOnboarding === 'function',
  'resolveAcceptOnboarding exported'
);

const page = fs.readFileSync(path.join(__dirname, '../account/hubert-intro.html'), 'utf8');
assert.ok(page.includes('hi-onboard'), 'accept page has onboarding panel');
assert.ok(page.includes('Confirm &amp; introduce us') || page.includes('Confirm & introduce us'), 'confirm CTA');
assert.ok(page.includes('lookingToMeet'), 'posts lookingToMeet');

const route = fs.readFileSync(path.join(__dirname, '../api/_lib/routes/hubert-intro.js'), 'utf8');
assert.ok(route.includes('accept_industry_required'), 'route maps onboarding errors');
assert.ok(route.includes('sessionFromRequest'), 'route passes session for attendee updates');

const introLib = fs.readFileSync(path.join(__dirname, '../api/_lib/hubert-intro-requests.js'), 'utf8');
assert.ok(introLib.includes('resolveAcceptOnboarding'), 'validates tags before accept');
assert.ok(introLib.includes('applyAcceptOnboardingTags'), 'applies tags on accept');

console.log('ok — hubert accept onboarding');
