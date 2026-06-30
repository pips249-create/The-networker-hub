/**
 * Single serverless function for SEO routes (Hobby plan function limit).
 */
const { getSubRoute } = require('./_lib/route-path');
const { json, setCors } = require('./_lib/auth');

const routes = {
  meta: require('./_lib/routes/seo-meta'),
  sitemap: require('./_lib/routes/seo-sitemap'),
  'hubert-schema': require('./_lib/routes/hubert-schema'),
};

module.exports = async function handler(req, res) {
  setCors(req, res);
  let route = getSubRoute(req, '/api/seo');
  if (!route && (req.query?.type || req.query?.slug || req.query?.page)) {
    route = 'meta';
  }
  const fn = routes[route];
  if (!fn) {
    return json(res, 404, { error: 'not_found', path: route || '(empty)' });
  }
  return fn(req, res);
};
