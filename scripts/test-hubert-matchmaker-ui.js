#!/usr/bin/env node
/**
 * Smoke tests for TINA client helpers (no DOM).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '../js/hubert-matchmaker.js'), 'utf8');
const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

const mm = sandbox.window.HubHubertMatchmaker;
if (!mm) {
  console.error('HubHubertMatchmaker missing');
  process.exit(1);
}

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

assert(mm.isMatchmakerPublic() === false, 'public launch must be off');
assert(mm.canBuildProfile({ role: 'client' }) === true, 'client can build profile');
assert(mm.canBuildProfile({ user: { role: 'client', email: 'a@b.co' } }) === true, 'client session can build');
assert(mm.canBuildProfile({ role: 'admin' }) === true, 'admin can build profile');
assert(mm.canBuildProfile(null) === false, 'signed-out cannot build profile');
assert(mm.canUseMatchmaker({ role: 'admin' }) === true, 'admin can search');
assert(mm.canUseMatchmaker({ user: { role: 'admin' } }) === true, 'admin session can search');
assert(mm.canUseMatchmaker({ role: 'client' }) === false, 'client search blocked while gated');
assert(mm.canUseMatchmaker(null) === false, 'signed-out search blocked');
assert(src.indexOf('searchEnabled') !== -1, 'searchEnabled gate for Ask TINA');
assert(src.indexOf('You’re in TINA’s pool') !== -1, 'profile-ready copy while search gated');
assert(src.indexOf('shareProfileInvite') !== -1, 'profile share invite helper');
const accountHtml = fs.readFileSync(path.join(__dirname, '../account/index.html'), 'utf8');
assert(accountHtml.indexOf('data-hmm-profile-share') !== -1, 'Meet people has invite share control');
assert(accountHtml.indexOf('Invite someone else') !== -1, 'Meet people invite CTA copy');
assert(accountHtml.indexOf('hmm-profile-actions') !== -1, 'Meet people centers profile actions');

assert(mm.shortDisplayName('Alex Morgan') === 'Alex M.', 'first + initial');
assert(mm.shortDisplayName('Priya') === 'Priya', 'single name');
assert(mm.shortDisplayName('  Sam Taylor-Jones ') === 'Sam T.', 'trim + initial');
assert(
  /Card heading — role \/ company \/ industry/.test(src),
  'shortlist cards document no-name privacy heading'
);
assert(src.indexOf("return 'Intro request'") !== -1, 'waiting list hides names until Accept');
assert(
  src.indexOf('What would you like to discuss?') !== -1,
  'intro topic form does not name the match'
);
assert(src.indexOf('window.prompt') === -1, 'intro topic no longer uses window.prompt');
assert(src.indexOf('hmm-topic-form') !== -1, 'inline topic form on match cards');
assert(src.indexOf('data-hmm-topic-form') !== -1, 'topic form bound per match');
assert(src.indexOf('openTopicForm') !== -1, 'Request intro opens sticky topic form');

const stubs = mm._stubShortlist('fintech founders');
assert(Array.isArray(stubs) && stubs.length === mm.MAX_SHORTLIST, 'max 5 stubs');
assert(stubs.every((p) => p.id !== 'stub-6'), '6th stub excluded by cap');
assert(
  stubs.every((p) => String(p.blurb || '').trim().length > 0),
  'stubs include blurbs so preview cards show description'
);
assert(
  stubs.every((p) => String(p.blurb || '').length <= 160),
  'stub blurbs stay within card teaser length'
);
assert(src.indexOf('hmm-match-blurb') !== -1, 'shortlist card renders blurb');
assert(src.indexOf('fitLabels') !== -1, 'shortlist cards render fit labels');
assert(src.indexOf('hmm-chip--fit-exact') !== -1, 'exact fit chip class');
assert(src.indexOf('Open to someone like you') !== -1 || src.indexOf('like_you') !== -1, 'like-you fit chip support');
assert(src.indexOf('hmm-match-meta') !== -1, 'card shows secondary role/industry meta');
assert(src.indexOf('function personMeta') !== -1, 'personMeta helper for card context');
assert(/role \/ company \/ industry/.test(src), 'card heading uses company context');
assert(src.indexOf('data-hmm-sug-q') !== -1, 'empty-state suggestion chips');
assert(src.indexOf('bindEmptySuggestions') !== -1, 'suggestion chips re-run search');

assert(typeof mm.emptyStateCopy === 'function', 'emptyStateCopy exported');
const eventEmpty = mm.emptyStateCopy({
  eventQuery: true,
  matchedEvents: [],
  eventAttendeeCount: 0,
});
assert(/match that event/i.test(eventEmpty.title), 'ui empty: unmatched event');

assert(src.indexOf('profile_incomplete') !== -1, 'client handles profile_incomplete');
assert(src.indexOf('search_quota_exceeded') !== -1, 'client handles search_quota_exceeded');
assert(src.indexOf('refreshSearchQuota') !== -1, 'client refreshes search quota');
assert(src.indexOf('Include me stays opt-in') !== -1, 'no auto opt-in comment');
assert(src.indexOf('applyProfileGate') !== -1, 'profile gate helper');
assert(src.indexOf('confirmStopIncludingMe') !== -1, 'opt-out needs confirmation');
assert(src.indexOf('Stop including me') !== -1, 'explicit opt-out control');
assert(src.indexOf('maybeSeedQueryFromUrl') !== -1, 'seeds Meet query from teaser q=');
assert(src.indexOf('needsEventPick') !== -1, 'client handles event confirm pick');
assert(src.indexOf('renderEventPick') !== -1, 'event pick UI helper');
assert(src.indexOf('Which event did you mean') !== -1, 'event pick empty copy');
assert(typeof mm._parseMeetQueryFromUrl === 'function', 'parseMeetQueryFromUrl exported');
// Guard must allow post-toggle opt-in (checked===true after click), not block it.
assert(src.indexOf('if (disc.checked)') !== -1, 'include-me click allows opt-in after toggle');
assert(
  /Checkbox click fires after the browser toggles/.test(src),
  'include-me click documents post-toggle timing'
);

const settingsSrc = fs.readFileSync(path.join(__dirname, '../js/account-settings.js'), 'utf8');
assert(
  /Checkbox click fires after the browser toggles/.test(settingsSrc),
  'settings include-me click documents post-toggle timing'
);
assert(settingsSrc.indexOf('if (disc.checked)') !== -1, 'settings allow include-me opt-in');

const settingsCss = fs.readFileSync(path.join(__dirname, '../css/account-settings.css'), 'utf8');
assert(
  settingsCss.indexOf('.as-discoverable-off[hidden]') !== -1,
  'settings hide Stop when not included'
);
const dashCss = fs.readFileSync(path.join(__dirname, '../css/attendee-dashboard.css'), 'utf8');
assert(
  dashCss.indexOf('.hmm-discoverable-off[hidden]') !== -1,
  'meet hide Stop when not included'
);
assert(dashCss.indexOf('.hmm-match-blurb') !== -1, 'shortlist blurb styles present');
assert(
  /hmm-profile-chip input:checked \+ span[\s\S]*?background:\s*#5b2d7a/.test(dashCss),
  'looking-to-meet selected chips use solid filled state'
);
assert(dashCss.indexOf('.hmm-empty-sug') !== -1, 'empty suggestion chip styles present');
assert(dashCss.indexOf('.hmm-chip--fit-exact') !== -1, 'exact fit chip styles present');
assert(dashCss.indexOf('.hmm-chip--fit-close') !== -1, 'close fit chip styles present');

console.log('ok — hubert-matchmaker ui helpers');
