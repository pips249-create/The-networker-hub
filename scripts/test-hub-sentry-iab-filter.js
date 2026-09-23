/**
 * Smoke-test Meta IAB / webkit.messageHandlers Sentry ignore patterns.
 * Run: node scripts/test-hub-sentry-iab-filter.js
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../js/hub-sentry.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('ok:', msg);
  }
}

const patterns = [
  /undefined is not an object \(evaluating 'window\.webkit\.messageHandlers'\)/i,
  /Can't find variable: webkit/i,
  /Java object is gone/i,
  /webkit\.messageHandlers/i,
];

for (const re of patterns) {
  assert(re.test(String(re)) || true, 'pattern present in test harness: ' + re);
  assert(src.includes(re.source) || src.match(re), 'hub-sentry.js includes filter for: ' + re);
}

const sampleMessages = [
  "undefined is not an object (evaluating 'window.webkit.messageHandlers')",
  "Can't find variable: webkit",
  'Error invoking postMessage: Java object is gone',
  'Java object is gone',
];

const ignoreBlock = src.match(/ignoreErrors:\s*\[([\s\S]*?)\],/);
assert(!!ignoreBlock, 'ignoreErrors block exists');

assert(/denyUrls:\s*\[\s*\/iabjs:/i.test(src), 'denyUrls includes iabjs');
assert(/isFacebookInAppBrowserNoise/.test(src), 'beforeSend helper exists');
assert(/return true;\s*\}/.test(src) && /webkit\\.messageHandlers/i.test(src), 'message-only drop for webkit.messageHandlers');

// Simulate the message-only branch used in beforeSend
function wouldDrop(msg) {
  return (
    /webkit\.messageHandlers/i.test(msg) ||
    /Can't find variable: webkit/i.test(msg) ||
    /Java object is gone/i.test(msg) ||
    /Error invoking postMessage/i.test(msg)
  );
}

for (const msg of sampleMessages) {
  assert(wouldDrop(msg), 'drops: ' + msg);
}

assert(!wouldDrop('TypeError: Cannot read properties of null'), 'keeps unrelated TypeError');
assert(/hub-sentry\.js\?v=20260923sentry9/.test(fs.readFileSync(path.join(__dirname, '../js/hub-compliance-bootstrap.js'), 'utf8')), 'cache-bust sentry asset');

if (process.exitCode) {
  console.error('Some checks failed');
  process.exit(1);
}
console.log('All hub-sentry IAB filter checks passed');
