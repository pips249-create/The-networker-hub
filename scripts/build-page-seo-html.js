#!/usr/bin/env node
/**
 * Sync static canonical + JSON-LD into guide and help HTML pages.
 */
const fs = require('fs');
const path = require('path');
const { GUIDE_PAGES, GUIDES_HUB, getGuidePageKeys } = require('../api/_lib/guide-pages');
const { HELP_PAGES, getHelpPageKeys } = require('../api/_lib/help-pages');
const {
  buildGuidePageSchema,
  buildGuidesHubSchema,
  buildHelpArticleSchema,
  siteOrigin,
  DEFAULT_ORIGIN,
} = require('../api/_lib/hubert-seo');

const ROOT = path.join(__dirname, '..');
const ORIGIN = siteOrigin(process.env.SITE_URL || DEFAULT_ORIGIN);

function injectSeo(html, canonicalUrl, schema) {
  let changed = false;
  const canonicalTag = '<link rel="canonical" href="' + canonicalUrl + '">';
  const canonicalRe = /<link rel="canonical" href="[^"]*">/;

  if (canonicalRe.test(html)) {
    if (html.match(canonicalRe)[0] !== canonicalTag) {
      html = html.replace(canonicalRe, canonicalTag);
      changed = true;
    }
  } else {
    html = html.replace('</head>', '  ' + canonicalTag + '\n</head>');
    changed = true;
  }

  const jsonLdTag =
    '<script type="application/ld+json" data-hubert-seo="static">' +
    JSON.stringify(schema) +
    '</script>';
  const jsonLdRe = /<script type="application\/ld\+json" data-hubert-seo="static">[\s\S]*?<\/script>/;

  if (jsonLdRe.test(html)) {
    if (html.match(jsonLdRe)[0] !== jsonLdTag) {
      html = html.replace(jsonLdRe, jsonLdTag);
      changed = true;
    }
  } else {
    html = html.replace('</head>', '  ' + jsonLdTag + '\n</head>');
    changed = true;
  }

  return { html: html, changed: changed };
}

function syncFile(relativePath, canonicalPath, schema) {
  const filePath = path.join(ROOT, relativePath.replace(/^\//, ''));
  if (!fs.existsSync(filePath)) {
    console.error('Missing file:', relativePath);
    process.exit(1);
  }

  const canonicalUrl = ORIGIN + canonicalPath;
  const result = injectSeo(fs.readFileSync(filePath, 'utf8'), canonicalUrl, schema);
  if (result.changed) {
    fs.writeFileSync(filePath, result.html, 'utf8');
    console.log('Updated', relativePath);
    return 1;
  }
  console.log('Up to date', relativePath);
  return 0;
}

let updates = 0;

updates += syncFile(GUIDES_HUB.path, GUIDES_HUB.path, buildGuidesHubSchema(ORIGIN));

getGuidePageKeys().forEach(function (guideKey) {
  const guide = GUIDE_PAGES[guideKey];
  updates += syncFile(guide.path, guide.path, buildGuidePageSchema(guideKey, ORIGIN));
});

getHelpPageKeys().forEach(function (helpKey) {
  const page = HELP_PAGES[helpKey];
  updates += syncFile(
    page.path.replace(/^\//, '') + '.html',
    page.path,
    buildHelpArticleSchema(helpKey, ORIGIN)
  );
});

if (!updates) {
  console.log('All guide and help pages already up to date');
}
