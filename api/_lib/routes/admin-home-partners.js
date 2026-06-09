const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { resolveImageUrl } = require('../supabase-storage');
const {
  HOME_PARTNERS_SLOT,
  parsePartnersBody,
  serializePartnersBody,
  normalizePartnersList,
  hasValidPartnerLogo,
  hasValidPartnerCta,
} = require('../home-partners');

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

async function fetchHomePartnersRow(sb) {
  const res = await sb.from('cms_blocks').select('*').eq('slot', HOME_PARTNERS_SLOT).maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return res.data || null;
}

async function resolvePartnerLogos(partners) {
  const out = [];
  for (let i = 0; i < partners.length; i++) {
    const p = { ...partners[i] };
    if (p.logoBase64) {
      const uploaded = await resolveImageUrl({
        folder: `sponsor-logos/home-partners/${p.id || 'partner'}`,
        logoUrl: p.logo_url,
        logoBase64: p.logoBase64,
        logoMime: p.logoMime,
        logoFilename: p.logoFilename,
      });
      if (uploaded) p.logo_url = uploaded;
      delete p.logoBase64;
      delete p.logoMime;
      delete p.logoFilename;
    }
    out.push(p);
  }
  return out;
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

  const sb = getSupabaseAdmin();

  if (req.method === 'GET') {
    try {
      const row = await fetchHomePartnersRow(sb);
      const partners = normalizePartnersList(parsePartnersBody(row?.body));
      return json(res, 200, {
        ok: true,
        configured: true,
        slot: HOME_PARTNERS_SLOT,
        active: row ? row.active !== false : true,
        partners,
        updatedAt: row?.updated_at || null,
      });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'partners_load_failed', message: e.message });
    }
  }

  if (req.method === 'POST') {
    const body = parseBody(req);
    const sectionActive = body.active !== false;
    let incoming = Array.isArray(body.partners) ? body.partners : [];

    try {
      const existingRow = await fetchHomePartnersRow(sb);
      const existingPartners = normalizePartnersList(parsePartnersBody(existingRow?.body));
      const existingById = new Map(existingPartners.map((p) => [p.id, p]));

      incoming = await resolvePartnerLogos(
        incoming.map((raw, index) => {
          const normalized = normalizePartnersList([raw])[0] || normalizePartnersList([{ id: `partner_${index}` }])[0];
          const prev = existingById.get(normalized.id);
          if (!normalized.logo_url && prev?.logo_url) {
            normalized.logo_url = prev.logo_url;
          }
          return normalized;
        })
      );

      const partners = normalizePartnersList(incoming);

      for (const p of partners) {
        if (!p.active) continue;
        if (!p.company_name) {
          return json(res, 400, { ok: false, error: 'missing_company_name' });
        }
        if (!hasValidPartnerLogo(p.logo_url)) {
          return json(res, 400, { ok: false, error: 'missing_partner_logo', partner: p.company_name });
        }
        if (!p.cta_label || !hasValidPartnerCta(p.cta_url)) {
          return json(res, 400, { ok: false, error: 'missing_partner_cta', partner: p.company_name });
        }
      }

      const row = {
        slot: HOME_PARTNERS_SLOT,
        title: 'Home page partners',
        subtitle: 'Home page partners',
        body: serializePartnersBody(partners),
        cta_label: 'Visit',
        cta_url: 'https://',
        logo_url: null,
        image_url: null,
        company_name: null,
        active: sectionActive,
        updated_at: new Date().toISOString(),
      };

      const saveRes = await sb.from('cms_blocks').upsert(row, { onConflict: 'slot' }).select().single();
      if (saveRes.error) throw new Error(saveRes.error.message);

      return json(res, 200, {
        ok: true,
        slot: HOME_PARTNERS_SLOT,
        active: sectionActive,
        partners: normalizePartnersList(parsePartnersBody(saveRes.data.body)),
        updatedAt: saveRes.data.updated_at,
      });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'partners_save_failed', message: e.message });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
