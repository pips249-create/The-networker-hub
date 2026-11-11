/**
 * Smoke-test weekly-report Sentry ignore patterns (HTML body, Stripe sync, elm.events.push).
 * Run: node scripts/test-hub-sentry-weekly-noise.js
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../js/hub-sentry.js'), 'utf8');
const bootstrap = fs.readFileSync(path.join(__dirname, '../js/hub-compliance-bootstrap.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('ok:', msg);
  }
}

assert(/isHtmlBodyAsErrorMessage/.test(src), 'HTML-body helper present');
assert(/isExpectedAdminStripeSyncNoise/.test(src), 'Stripe sync helper present');
assert(/isThirdPartyEventsPushNoise/.test(src), 'elm.events.push helper present');

assert(/\/\^<!DOCTYPE\\s\+html\/i/.test(src), 'ignoreErrors includes DOCTYPE');
assert(/No completed Stripe checkout found for this listing yet/.test(src), 'ignoreErrors includes Stripe sync');
assert(/elm\\.events\\.push is not a function/.test(src), 'ignoreErrors includes elm.events.push');

function wouldDropHtml(msg) {
  var trimmed = String(msg || '')
    .replace(/^\uFEFF/, '')
    .trim();
  return (
    /^<!DOCTYPE\s+html/i.test(trimmed) ||
    /^<html[\s>]/i.test(trimmed) ||
    /<!--\[if\s+lt\s+IE/i.test(trimmed)
  );
}

function wouldDropStripe(msg) {
  return /No completed Stripe checkout found for this listing yet/i.test(msg);
}

function wouldDropElm(msg) {
  return /elm\.events\.push is not a function/i.test(msg);
}

assert(
  wouldDropHtml(
    '<!DOCTYPE html> <!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->'
  ),
  'drops Cloudflare-style HTML error message'
);
assert(wouldDropStripe('No completed Stripe checkout found for this listing yet. Wait a minute'), 'drops Stripe sync UX');
assert(wouldDropElm('elm.events.push is not a function'), 'drops elm.events.push');
assert(!wouldDropHtml('Server returned an HTML page instead of JSON (HTTP 502)'), 'keeps short HTML-response code');
assert(!wouldDropElm('TypeError: Cannot read properties of null'), 'keeps unrelated TypeError');

assert(/hub-sentry\.js\?v=20261111sentry10/.test(bootstrap), 'cache-bust sentry asset bumped');

if (process.exitCode) {
  console.error('Some checks failed');
  process.exit(1);
}
console.log('All hub-sentry weekly-noise filter checks passed');
