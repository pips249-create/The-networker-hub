#!/usr/bin/env node
/**
 * Sync og:image / twitter:image in static HTML from seo-static-pages config.
 */
const fs = require('fs');
const path = require('path');
const { STATIC_PAGES, absoluteUrl } = require('../api/_lib/seo-static-pages');
const { siteOrigin, DEFAULT_ORIGIN } = require('../api/_lib/hubert-seo');
const { OG_SHARE_IMAGE } = require('../api/_lib/hub-brand');

const ROOT = path.join(__dirname, '..');
const ORIGIN = siteOrigin(process.env.SITE_URL || DEFAULT_ORIGIN);
const SHARE_IMAGE_URL = absoluteUrl(ORIGIN, OG_SHARE_IMAGE);
const OLD_IMAGE_URL = absoluteUrl(ORIGIN, '/assets/logo.png');

function walkHtmlFiles(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    if (entry.name.startsWith('.')) return;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'admin' || entry.name === 'international') return;
      walkHtmlFiles(full, out);
    } else if (entry.name.endsWith('.html')) {
      out.push(full);
    }
  });
}

function syncShareImages(html) {
  let changed = false;
  let next = html;

  const replacements = [
    [OLD_IMAGE_URL, SHARE_IMAGE_URL],
    ['https://www.thenetworkeruk.com/assets/logo.png', SHARE_IMAGE_URL],
    ['http://localhost:3000/assets/logo.png', absoluteUrl(ORIGIN, OG_SHARE_IMAGE)],
  ];

  replacements.forEach(function ([from, to]) {
    if (next.indexOf(from) === -1) return;
    next = next.split(from).join(to);
    changed = true;
  });

  const ogImageBlock =
    '<meta property="og:image" content="' +
    SHARE_IMAGE_URL +
    '">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta property="og:image:alt" content="The Networker UK">';
  const ogImageRe =
    /<meta property="og:image" content="[^"]*">(?:\n<meta property="og:image:width" content="[^"]*">)?(?:\n<meta property="og:image:height" content="[^"]*">)?(?:\n<meta property="og:image:alt" content="[^"]*">)?/;

  if (ogImageRe.test(next)) {
    const match = next.match(ogImageRe)[0];
    if (match !== ogImageBlock) {
      next = next.replace(ogImageRe, ogImageBlock);
      changed = true;
    }
  }

  return { html: next, changed: changed };
}

const files = [];
walkHtmlFiles(ROOT, files);

let updates = 0;
files.forEach(function (filePath) {
  const rel = path.relative(ROOT, filePath);
  if (!fs.readFileSync(filePath, 'utf8').includes('og:image')) return;

  const result = syncShareImages(fs.readFileSync(filePath, 'utf8'));
  if (result.changed) {
    fs.writeFileSync(filePath, result.html, 'utf8');
    console.log('Updated share image:', rel);
    updates += 1;
  }
});

if (!updates) {
  console.log('All static share images already up to date (' + SHARE_IMAGE_URL + ')');
} else {
  console.log('Share image URL:', SHARE_IMAGE_URL);
}

// Regenerate hub-seo-static-config.js values via build-hub-seo-data (image field lives in STATIC_PAGES).
void STATIC_PAGES;
