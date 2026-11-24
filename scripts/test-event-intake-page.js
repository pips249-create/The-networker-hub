#!/usr/bin/env node
/**
 * Smoke checks for /add-your-event layout guards (no browser).
 */
const fs = require('fs');
const path = require('path');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'add-your-event.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/event-intake-page.css'), 'utf8');
const mobileCss = fs.readFileSync(path.join(root, 'css/hub-mobile.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'js/event-intake-page.js'), 'utf8');

assert(html.indexOf('id="ei-form"') !== -1, 'intake form present');
assert(html.indexOf('id="ei-location-inperson"') !== -1, 'in-person location block present');
assert(html.indexOf('id="ei-location-online"') !== -1, 'online location block present');
assert(/id="ei-location-online"[^>]*\bhidden\b/.test(html), 'online block starts hidden');
assert(html.indexOf('name="format" value="Online"') !== -1, 'Online format option present');
assert(html.indexOf('id="ei-submit"') !== -1, 'submit button present');

assert(
  css.indexOf('.event-intake-page .ei-grid[hidden]') !== -1,
  'CSS forces [hidden] grids to display:none (author display:grid otherwise wins)'
);
assert(
  css.indexOf('.event-intake-page .ei-field[hidden]') !== -1,
  'CSS forces [hidden] fields to display:none'
);
assert(
  /display:\s*none\s*!important/.test(css),
  'hidden override uses !important'
);
assert(
  /\.ei-submit[\s\S]*?color:\s*#fff\s*!important/.test(css),
  'submit label is white on teal (not charcoal from .btn-primary)'
);
assert(
  /\.ei-field input:not\(\[type='radio'\]\):not\(\[type='checkbox'\]\)[\s\S]*?font-size:\s*16px/.test(
    css
  ),
  'text inputs use 16px to stop iOS focus zoom'
);

assert(
  mobileCss.indexOf('.event-intake-page .ei-field input') !== -1,
  'hub-mobile includes intake inputs in iOS 16px zoom guard'
);

assert(js.indexOf('function syncFormat') !== -1, 'format sync toggles location blocks');
assert(js.indexOf("inPersonEl.hidden = !!isOnline") !== -1, 'Online hides in-person fields');
assert(js.indexOf('onlineEl.hidden = !isOnline') !== -1, 'Online shows meeting-link fields');

console.log('ok — event intake page guards');
