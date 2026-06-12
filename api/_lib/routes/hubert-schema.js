/**
 * GET /api/seo/hubert-schema — JSON-LD and llms.txt content from Hubert knowledge (SEO/AEO).
 * Query: page=home|faq|contact|about|all  ·  format=json|llms
 */
const { json, setCors } = require('../auth');
const { buildSchemaGraph, buildLlmsTxt, FAQ_AEO_ENTRIES } = require('../hubert-seo');

module.exports = async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  const format = String(req.query?.format || 'json').toLowerCase();
  const page = String(req.query?.page || 'home').toLowerCase();
  const origin = req.headers['x-forwarded-host']
    ? 'https://' + req.headers['x-forwarded-host']
    : undefined;

  if (format === 'llms') {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(buildLlmsTxt(origin));
  }

  if (page === 'faq-entries') {
    return json(res, 200, { ok: true, entries: FAQ_AEO_ENTRIES });
  }

  const graph = buildSchemaGraph(page === 'all' ? 'home' : page, origin);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return json(res, 200, { ok: true, page: page, schema: graph });
};
