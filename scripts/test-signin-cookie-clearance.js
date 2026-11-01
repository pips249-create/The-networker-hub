#!/usr/bin/env node
/**
 * Guards the mobile Sign in fix: cookie banner must reserve body space so
 * #login-submit stays clickable, and auth CSS must put the form first on mobile.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed += 1;
  } else {
    console.log('ok:', msg);
  }
}

const cookieJs = fs.readFileSync(path.join(root, 'js/cookie-consent.js'), 'utf8');
const cookieCss = fs.readFileSync(path.join(root, 'css/cookie-consent.css'), 'utf8');
const authCss = fs.readFileSync(path.join(root, 'css/auth.css'), 'utf8');
const bootstrap = fs.readFileSync(path.join(root, 'js/hub-compliance-bootstrap.js'), 'utf8');
const siteNav = fs.readFileSync(path.join(root, 'js/site-nav.js'), 'utf8');
const loginHtml = fs.readFileSync(path.join(root, 'login.html'), 'utf8');

assert(/hub-cookie-banner-open/.test(cookieJs), 'cookie-consent.js sets hub-cookie-banner-open');
assert(/--hub-cookie-banner-h/.test(cookieJs), 'cookie-consent.js sets banner height CSS var');
assert(/watchBannerSpace/.test(cookieJs), 'cookie-consent.js watches banner size');
assert(
  /body\.hub-cookie-banner-open\s*\{[^}]*padding-bottom:\s*var\(--hub-cookie-banner-h/s.test(cookieCss),
  'cookie-consent.css pads body while banner is open'
);
assert(
  /\.auth-main--split\s+\.auth-panel--form\s*\{[^}]*order:\s*-1/s.test(authCss),
  'auth.css puts form panel first on mobile'
);
assert(/scroll-margin-bottom:\s*calc\(var\(--hub-cookie-banner-h/.test(authCss), 'auth submit has scroll-margin for banner');
assert(/cookie-consent\.css\?v=20261101cookie1/.test(bootstrap), 'bootstrap cache-busts cookie CSS');
assert(/BUILD = '20261101cookie1'/.test(bootstrap), 'bootstrap BUILD matches cookie fix');
assert(/isAuthChromePage/.test(siteNav), 'site-nav skips redundant Sign in on auth pages');
assert(/auth\.css\?v=20261101signin1/.test(loginHtml), 'login.html cache-busts auth.css');
assert(/site-nav\.js\?v=20261101signin1/.test(loginHtml), 'login.html cache-busts site-nav.js');

if (failed) {
  console.error(failed + ' check(s) failed');
  process.exit(1);
}
console.log('All sign-in cookie clearance checks passed');
