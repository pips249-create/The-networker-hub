#!/usr/bin/env node
/**
 * Sync static canonical + JSON-LD into public HTML pages.
 * AI crawlers often skip JavaScript — schema must ship in the initial HTML.
 */
const fs = require('fs');
const path = require('path');
const { GUIDE_PAGES, GUIDES_HUB, getGuidePageKeys } = require('../api/_lib/guide-pages');
const { HELP_PAGES, getHelpPageKeys } = require('../api/_lib/help-pages');
const {
  buildGuidePageSchema,
  buildGuidesHubSchema,
  buildHelpArticleSchema,
  buildSchemaGraph,
  siteOrigin,
  DEFAULT_ORIGIN,
} = require('../api/_lib/hubert-seo');
const { STATIC_PAGES } = require('../api/_lib/seo-static-pages');

const ROOT = path.join(__dirname, '..');
const ORIGIN = siteOrigin(process.env.SITE_URL || DEFAULT_ORIGIN);

/** Pages already covered by STATIC_PAGES + buildSchemaGraph — skip duplicate keys. */
const SKIP_STATIC_KEYS = new Set([
  // Same HTML as for-networkers
  'for-attendees',
]);

function fileFromPublicPath(publicPath) {
  const p = String(publicPath || '').replace(/^\//, '').replace(/\/$/, '');
  if (!p || p === '') return 'index.html';
  if (p === 'guides') return 'guides.html';
  if (p === 'events') return 'events/index.html';
  if (p === 'opportunities') return 'opportunities/index.html';
  if (p === 'partners') return 'partners/index.html';
  if (p.startsWith('help/')) return p + '.html';
  if (p.startsWith('guides/')) return p + '.html';
  return p.endsWith('.html') ? p : p + '.html';
}

function fileFromStaticPage(pageKey, page) {
  if (pageKey === 'home' || page.path === '/') return 'index.html';
  return fileFromPublicPath(page.path);
}

function discoveryLinksHtml() {
  return (
    '<link rel="alternate" type="text/plain" href="' +
    ORIGIN +
    '/llms.txt" title="llms.txt">\n' +
    '<link rel="sitemap" type="application/xml" title="Sitemap" href="' +
    ORIGIN +
    '/sitemap.xml">'
  );
}

function injectSeo(html, canonicalUrl, schema, options) {
  const opts = options || {};
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

  // Drop hand-rolled CollectionPage / FAQ blocks that would duplicate the static graph.
  const legacyJsonLdRe =
    /<script type="application\/ld\+json">\s*\{[\s\S]*?"@type"\s*:\s*"(?:CollectionPage|FAQPage)"[\s\S]*?\}\s*<\/script>\n?/g;
  if (legacyJsonLdRe.test(html)) {
    html = html.replace(legacyJsonLdRe, '');
    changed = true;
  }

  if (opts.discoveryLinks) {
    const links = discoveryLinksHtml();
    const llmsRe =
      /<link rel="alternate" type="text\/plain" href="[^"]*\/llms\.txt"[^>]*>\s*/;
    const sitemapLinkRe =
      /<link rel="sitemap" type="application\/xml"[^>]*>\s*/;
    const hasLlms = llmsRe.test(html);
    const hasSitemapLink = sitemapLinkRe.test(html);
    if (!hasLlms || !hasSitemapLink) {
      html = html.replace(llmsRe, '').replace(sitemapLinkRe, '');
      html = html.replace('</head>', links + '\n</head>');
      changed = true;
    } else {
      const expectedLlms =
        '<link rel="alternate" type="text/plain" href="' + ORIGIN + '/llms.txt" title="llms.txt">';
      const expectedSitemap =
        '<link rel="sitemap" type="application/xml" title="Sitemap" href="' + ORIGIN + '/sitemap.xml">';
      if (!html.includes(expectedLlms) || !html.includes(expectedSitemap)) {
        html = html.replace(llmsRe, '').replace(sitemapLinkRe, '');
        html = html.replace('</head>', links + '\n</head>');
        changed = true;
      }
    }
  }

  return { html: html, changed: changed };
}

function syncFile(relativePath, canonicalPath, schema, options) {
  const filePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(filePath)) {
    console.error('Missing file:', relativePath);
    process.exit(1);
  }

  const canonicalUrl = ORIGIN + canonicalPath;
  const result = injectSeo(fs.readFileSync(filePath, 'utf8'), canonicalUrl, schema, options);
  if (result.changed) {
    fs.writeFileSync(filePath, result.html, 'utf8');
    console.log('Updated', relativePath);
    return 1;
  }
  console.log('Up to date', relativePath);
  return 0;
}

let updates = 0;

// Primary path: every STATIC_PAGES entry gets Organization (+ page schema) in HTML.
Object.keys(STATIC_PAGES).forEach(function (pageKey) {
  if (SKIP_STATIC_KEYS.has(pageKey)) return;
  // Guide / help pages use dedicated builders below for stable @graph shape.
  if (pageKey.indexOf('guide-') === 0) return;
  if (pageKey.indexOf('help-') === 0) return;
  if (pageKey === 'guides') return;

  const page = STATIC_PAGES[pageKey];
  const relativePath = fileFromStaticPage(pageKey, page);
  const schema = buildSchemaGraph(pageKey, ORIGIN);
  updates += syncFile(relativePath, page.path, schema, {
    discoveryLinks: pageKey === 'home',
  });
});

updates += syncFile(
  fileFromPublicPath(GUIDES_HUB.path),
  GUIDES_HUB.path,
  buildGuidesHubSchema(ORIGIN)
);

getGuidePageKeys().forEach(function (guideKey) {
  const guide = GUIDE_PAGES[guideKey];
  updates += syncFile(
    fileFromPublicPath(guide.path),
    guide.path,
    buildGuidePageSchema(guideKey, ORIGIN)
  );
});

getHelpPageKeys().forEach(function (helpKey) {
  const page = HELP_PAGES[helpKey];
  updates += syncFile(
    fileFromPublicPath(page.path),
    page.path,
    buildHelpArticleSchema(helpKey, ORIGIN)
  );
});

if (!updates) {
  console.log('All public SEO pages already up to date');
}
