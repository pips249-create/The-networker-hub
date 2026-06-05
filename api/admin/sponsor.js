const { sessionFromRequest, requireAdmin, json, setCors } = require('../_lib/auth');
const { getAdminSponsor, saveSponsorBlock } = require('../_lib/admin-supabase-data');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../_lib/supabase');
const { resolveImageUrl } = require('../_lib/supabase-storage');

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

async function resolveLogoUrl(body) {
  let logo_url = String(body.logo_url || '').trim() || null;
  if (body.logoBase64) {
    const uploaded = await resolveImageUrl({
      folder: 'sponsor-logos',
      logoUrl: body.logo_url,
      logoBase64: body.logoBase64,
      logoMime: body.logoMime,
      logoFilename: body.logoFilename,
    });
    if (uploaded) logo_url = uploaded;
  }
  return logo_url;
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error });

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  if (req.method === 'GET') {
    try {
      const report = await getAdminSponsor();
      return json(res, 200, { ok: true, ...report });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'sponsor_load_failed', message: e.message });
    }
  }

  if (req.method === 'POST') {
    const body = parseBody(req);
    const title = String(body.title || '').trim();
    const blockBody = String(body.body || '').trim();
    const cta_label = String(body.cta_label || '').trim();
    const cta_url = String(body.cta_url || '').trim();
    const company_name = String(body.company_name || '').trim();

    if (!blockBody) {
      return json(res, 400, { ok: false, error: 'missing_body' });
    }
    if (!cta_label || !cta_url) {
      return json(res, 400, { ok: false, error: 'missing_cta' });
    }

    try {
      const sb = getSupabaseAdmin();
      const logo_url = await resolveLogoUrl(body);
      const block = await saveSponsorBlock(sb, {
        title,
        body: blockBody,
        cta_label,
        cta_url,
        logo_url,
        company_name,
        active: body.active !== false,
      });
      return json(res, 200, { ok: true, block, updatedAt: new Date().toISOString() });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'sponsor_save_failed', message: e.message });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
