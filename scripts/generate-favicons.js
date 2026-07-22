#!/usr/bin/env node
/**
 * SVG hub mark → PNG sizes + favicon.ico at repo root.
 * Run: node scripts/generate-favicons.js
 */
const { execSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const svgPath = path.join(root, 'assets/favicon.svg');
const assetsDir = path.join(root, 'assets');

function renderPng(size, outName) {
  const outPath = path.join(assetsDir, outName);
  execSync(
    `npx --yes sharp-cli -i "${svgPath}" -o "${outPath}" resize ${size} ${size}`,
    { stdio: 'inherit', cwd: root }
  );
}

renderPng(16, 'favicon-16.png');
renderPng(32, 'favicon-32.png');
renderPng(180, 'apple-touch-icon.png');

execSync(`python3 "${path.join(__dirname, 'generate-favicon-ico.py')}"`, {
  stdio: 'inherit',
  cwd: root,
});
