#!/usr/bin/env node
/**
 * Smoke tests for Hubert Matchmaker public teaser helpers (no DOM session).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const teaserSrc = fs.readFileSync(path.join(__dirname, '../js/hubert-matchmaker-teaser.js'), 'utf8');
const mmSrc = fs.readFileSync(path.join(__dirname, '../js/hubert-matchmaker.js'), 'utf8');
const homeHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const eventsHtml = fs.readFileSync(path.join(__dirname, '../events/index.html'), 'utf8');
const dashSrc = fs.readFileSync(path.join(__dirname, '../js/attendee-dashboard.js'), 'utf8');

function loadTeaser() {
  const sandbox = {
    window: {},
    document: {
      readyState: 'complete',
      querySelectorAll: function () {
        return [];
      },
      addEventListener: function () {},
    },
    fetch: function () {
      return Promise.resolve({
        json: function () {
          return Promise.resolve({});
        },
      });
    },
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(teaserSrc, sandbox);
  return sandbox.window.HubHubertMatchmakerTeaser;
}

const teaser = loadTeaser();
assert.ok(teaser, 'HubHubertMatchmakerTeaser exported');
assert.strictEqual(teaser.isMatchmakerPublic(), false, 'teaser public flag off');
assert.strictEqual(teaser.canSeeTeaser({ role: 'admin' }), true, 'admin sees teaser while gated');
assert.strictEqual(teaser.canSeeTeaser({ user: { role: 'admin' } }), true, 'admin session sees teaser');
assert.strictEqual(teaser.canSeeTeaser({ role: 'client' }), false, 'client hidden while gated');
assert.strictEqual(teaser.canSeeTeaser(null), false, 'signed-out hidden while gated');

assert.strictEqual(teaser.meetUrl(''), '/account/#meet', 'empty meet url');
assert.strictEqual(
  teaser.meetUrl('fintech angels'),
  '/account/#meet?q=' + encodeURIComponent('fintech angels'),
  'meet url encodes q'
);
assert.ok(teaser.registerUrl('x').indexOf('/register?intent=attendee') === 0, 'register intent');
assert.ok(teaser.registerUrl('x').indexOf('utm_source=hubert') !== -1, 'register utm');
assert.ok(teaser.registerUrl('x').indexOf(encodeURIComponent('/account/#meet?q=x')) !== -1, 'register next');

assert.ok(homeHtml.indexOf('data-hmm-teaser') !== -1, 'home mounts teaser');
assert.ok(homeHtml.indexOf('hubert-matchmaker-teaser.css') !== -1, 'home loads teaser css');
assert.ok(homeHtml.indexOf('hubert-matchmaker-teaser.js') !== -1, 'home loads teaser js');
assert.ok(
  /Try:.*solicitor|Try:.*SaaS founder/i.test(homeHtml),
  'home teaser placeholder guides role/industry asks'
);
assert.ok(eventsHtml.indexOf('data-hmm-teaser') !== -1, 'events mounts teaser');
assert.ok(eventsHtml.indexOf('hubert-matchmaker-teaser.css') !== -1, 'events loads teaser css');
assert.ok(eventsHtml.indexOf('hubert-matchmaker-teaser.js') !== -1, 'events loads teaser js');
assert.ok(
  /Try:.*solicitor|Try:.*SaaS founder/i.test(eventsHtml),
  'events teaser placeholder guides role/industry asks'
);

const accountHtml = fs.readFileSync(path.join(__dirname, '../account/index.html'), 'utf8');
assert.ok(
  accountHtml.indexOf('Try: commercial solicitor in Manchester, or B2B SaaS founder') !== -1,
  'Meet people placeholder guides short role asks'
);

assert.ok(
  /hash\.indexOf\(['"]meet\?['"]\)\s*===\s*0/.test(dashSrc),
  'dashboard parseRoute accepts #meet?q='
);
assert.ok(mmSrc.indexOf('parseMeetQueryFromUrl') !== -1, 'meet seeds q from url');
assert.ok(mmSrc.indexOf('maybeSeedQueryFromUrl') !== -1, 'meet seed helper present');
assert.ok(mmSrc.indexOf('_parseMeetQueryFromUrl') !== -1, 'parse helper exported');

const flagTeaser = (teaserSrc.match(/HUBERT_MATCHMAKER_PUBLIC\s*=\s*(true|false)/) || [])[1];
const flagMm = (mmSrc.match(/HUBERT_MATCHMAKER_PUBLIC\s*=\s*(true|false)/) || [])[1];
assert.strictEqual(flagTeaser, flagMm, 'teaser and dashboard public flags stay in sync');
assert.strictEqual(flagTeaser, 'false', 'launch flag still off');

console.log('ok — hubert-matchmaker teaser helpers');
