#!/usr/bin/env node
/**
 * Single-country regions should not say “Canada is part of Canada”.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'international-home.js'),
  'utf8'
);

assert.ok(src.includes('singleCountry'), 'expected single-country region lede branch');
assert.ok(src.includes('sameName'), 'expected same-name region lede branch');
assert.ok(src.includes(' is part of '), 'multi-country “is part of” lede kept for real regions');

const css = fs.readFileSync(
  path.join(__dirname, '..', 'css', 'international-home.css'),
  'utf8'
);
assert.ok(css.includes('min-height: 0'), 'browse panel needs min-height:0 for flex scroll');
assert.ok(
  /\.intl-browse-list\s*\{[\s\S]*?overflow-y:\s*auto/.test(css),
  'browse list should scroll independently'
);

console.log('test-intl-browse-lede: ok');
