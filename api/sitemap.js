/**
 * GET /api/sitemap — XML sitemap (also rewritten from /sitemap.xml).
 * Dedicated function so rewrite does not depend on /api/seo sub-route parsing.
 */
const { buildSitemapXml } = require('./_lib/seo-sitemap');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    return res.end('method_not_allowed');
  }

  const origin = req.headers['x-forwarded-host']
    ? 'https://' + req.headers['x-forwarded-host']
    : undefined;

  try {
    const xml = await buildSitemapXml(origin);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.statusCode = 200;
    if (req.method === 'HEAD') return res.end();
    return res.end(xml);
  } catch (e) {
    console.error('sitemap_failed', e && e.message ? e.message : e);
    res.statusCode = 500;
    return res.end('sitemap_failed');
  }
};
