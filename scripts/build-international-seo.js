#!/usr/bin/env node
/**
 * Updates international SEO/AEO files (sitemap lastmod).
 * llms.txt and agents.txt are hand-maintained in international/.
 */
const fs = require('fs');
const path = require('path');

const today = new Date().toISOString().slice(0, 10);
const sitemapPath = path.join(__dirname, '..', 'international', 'sitemap.xml');

const urls = [
  { loc: 'https://www.thenetworkerinternational.com/', priority: '1.0' },
  { loc: 'https://www.thenetworkerinternational.com/ireland', priority: '0.9' },
  { loc: 'https://www.thenetworkerinternational.com/united-states', priority: '0.9' },
];

const body = urls
  .map(function (u) {
    return (
      '  <url>\n' +
      '    <loc>' +
      u.loc +
      '</loc>\n' +
      '    <lastmod>' +
      today +
      '</lastmod>\n' +
      '    <changefreq>weekly</changefreq>\n' +
      '    <priority>' +
      u.priority +
      '</priority>\n' +
      '  </url>'
    );
  })
  .join('\n');

const xml =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  body +
  '\n</urlset>\n';

fs.writeFileSync(sitemapPath, xml, 'utf8');
console.log('Wrote', sitemapPath, '(lastmod', today + ')');
