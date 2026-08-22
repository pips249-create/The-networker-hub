/**
 * Import brand kit from an organiser website (colours, social links, logo, description).
 */
const { getOrganiserApi } = require('../organiser-provider');
const { fetchWebsiteMeta } = require('../website-meta');

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body || {};
}

module.exports = async function handler(req, res) {
  const { json, setCors, requireOrganiserSession } = getOrganiserApi();
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const auth = await requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  const body = parseBody(req);
  const url = String(body.url || body.website || '').trim();
  if (!url) {
    return json(res, 400, {
      ok: false,
      error: 'missing_url',
      message: 'Enter your website URL first.',
    });
  }

  try {
    const meta = await fetchWebsiteMeta(url);
    return json(res, 200, {
      ok: true,
      url: meta.url,
      logoUrl: meta.logo_url || '',
      description: meta.description || '',
      instagramUrl: meta.instagram_url || '',
      facebookUrl: meta.facebook_url || '',
      linkedinUrl: meta.linkedin_url || '',
      xUrl: meta.x_url || '',
      brandPrimaryColor: meta.brand_primary_color || '',
      brandSecondaryColor: meta.brand_secondary_color || '',
      brandAccentColor: meta.brand_accent_color || '',
      colors: meta.colors || [],
      blocked: Boolean(meta.blocked),
      message:
        meta.message ||
        'We found brand details on your website. Review them, then save.',
    });
  } catch (e) {
    return json(res, e.status || 500, {
      ok: false,
      error: e.message || 'website_brand_failed',
      message: e.message || 'Could not read that website.',
    });
  }
};
