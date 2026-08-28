/**
 * Single serverless function for SEO routes (Hobby plan function limit).
 */
const { getSubRoute } = require('./_lib/route-path');
const { wrapHandler } = require('./_lib/sentry');
const { json, setCors } = require('./_lib/auth');

const routes = {
  meta: require('./_lib/routes/seo-meta'),
  sitemap: require('./_lib/routes/seo-sitemap'),
  'hubert-schema': require('./_lib/routes/hubert-schema'),
};

function requestPathname(req) {
  if (!req || !req.url) return '';
  try {
    return new URL(req.url, 'https://internal.local').pathname || '';
  } catch {
    return String(req.url).split('?')[0] || '';
  }
}

module.exports = wrapHandler(async function handler(req, res) {
  setCors(req, res);
  let route = getSubRoute(req, '/api/seo');
  // Rewrites: /sitemap.xml → /api/seo/sitemap or /api/seo?route=sitemap
  if (!route && req.query?.route) {
    route = String(req.query.route).trim();
  }
  // vercel.dev sometimes keeps the public path on req.url after rewrite.
  const pathname = requestPathname(req);
  if ((!route || route === '.xml') && /\/sitemap\.xml$/i.test(pathname)) {
    route = 'sitemap';
  }
  if (route === '-meta') route = 'meta';
  if (!route && (req.query?.type || req.query?.slug || req.query?.page)) {
    route = 'meta';
  }
  const fn = routes[route];
  if (!fn) {
    return json(res, 404, { error: 'not_found', path: route || '(empty)' });
  }
  return fn(req, res);
});