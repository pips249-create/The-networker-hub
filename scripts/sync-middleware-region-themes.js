#!/usr/bin/env node
/**
 * Regenerates the NETWORKING_REGION_THEMES block in middleware.js from api/_lib.
 * Run after editing region-landmark-icons.js or networking-region-themes.js.
 */
const fs = require('fs');
const path = require('path');

const { REGION_THEMES } = require('../api/_lib/networking-region-themes');

const root = path.join(__dirname, '..');
const middlewarePath = path.join(root, 'middleware.js');
let source = fs.readFileSync(middlewarePath, 'utf8');

const slim = {};
for (const [slug, theme] of Object.entries(REGION_THEMES)) {
  slim[slug] = {
    tagline: theme.tagline,
    landmark: theme.landmark,
  };
}

const block =
  '/** Edge-safe copy of api/_lib/networking-region-themes.js accents + landmarks. */\n' +
  'const NETWORKING_REGION_THEMES = ' +
  JSON.stringify(slim, null, 2) +
  ';';

const pattern = /\/\*\* Edge-safe copy of api\/_lib\/networking-region-themes\.js[\s\S]*?^const NETWORKING_REGION_THEMES = \{[\s\S]*?\n\};/m;
if (!pattern.test(source)) {
  console.error('Could not find NETWORKING_REGION_THEMES block in middleware.js');
  process.exit(1);
}

source = source.replace(pattern, block);
fs.writeFileSync(middlewarePath, source);
console.log('Updated NETWORKING_REGION_THEMES in middleware.js');
