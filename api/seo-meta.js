/**
 * GET /api/seo-meta?type=event|organiser&slug=...
 * Returns title, description, canonical, Open Graph tags, and JSON-LD.
 */
const { setCors, json } = require('./_lib/auth');
const { buildSeoMeta } = require('./_lib/seo-meta');

module.exports = async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  const type = String(req.query?.type || '').trim().toLowerCase();
  const slug = String(req.query?.slug || req.query?.page || '').trim();
  if (!type) {
    return json(res, 400, { ok: false, error: 'missing_type' });
  }
  if (!slug) {
    return json(res, 400, { ok: false, error: 'missing_slug_or_page' });
  }

  const origin = req.headers['x-forwarded-host']
    ? 'https://' + req.headers['x-forwarded-host']
    : undefined;

  try {
    const meta = await buildSeoMeta(type, slug, origin);
    if (!meta) {
      return json(res, 404, { ok: false, error: 'not_found' });
    }
    res.setHeader('Cache-Control', 'public, max-age=300');
    return json(res, 200, meta);
  } catch (e) {
    return json(res, 500, { ok: false, error: 'seo_meta_failed', message: e.message });
  }
};
