const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { getAdminSponsor, saveSponsorBlock, copySponsorBlock } = require('../admin-supabase-data');
const { BOOKING_EMAIL_SPONSOR_SLOT, EVENTS_SPONSOR_SLOT } = require('../email-booking-defaults');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { resolveImageUrl } = require('../supabase-storage');

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

function slotFromRequest(req) {
  if (req.query && req.query.slot) return String(req.query.slot).trim();
  try {
    const url = new URL(req.url, 'https://internal.local');
    return String(url.searchParams.get('slot') || '').trim();
  } catch {
    return '';
  }
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
      const slot = slotFromRequest(req) || 'events_sponsor_hub';
      const report = await getAdminSponsor(slot);
      return json(res, 200, { ok: true, ...report });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'sponsor_load_failed', message: e.message });
    }
  }

  if (req.method === 'POST') {
    const body = parseBody(req);
    const action = String(body.action || '').trim();

    if (action === 'sync_from') {
      const fromSlot = String(body.from_slot || EVENTS_SPONSOR_SLOT).trim() || EVENTS_SPONSOR_SLOT;
      const toSlot = String(body.slot || BOOKING_EMAIL_SPONSOR_SLOT).trim() || BOOKING_EMAIL_SPONSOR_SLOT;
      try {
        const sb = getSupabaseAdmin();
        const block = await copySponsorBlock(sb, fromSlot, toSlot);
        return json(res, 200, { ok: true, block, slot: toSlot, syncedFrom: fromSlot });
      } catch (e) {
        const code = e.code || 'sponsor_sync_failed';
        const status = code === 'source_not_found' ? 404 : 500;
        return json(res, status, { ok: false, error: code, message: e.message });
      }
    }

    const slot = String(body.slot || 'events_sponsor_hub').trim() || 'events_sponsor_hub';
    const title = String(body.title || '').trim();
    const blockBody = String(body.body || '').trim();
    const cta_label = String(body.cta_label || '').trim();
    const cta_url = String(body.cta_url || '').trim();
    const company_name = String(body.company_name || '').trim();
    const cta_color = String(body.cta_color || '').trim();
    const isCityPartner = /^networking_city_partner_/i.test(slot);

    if (!cta_label || !cta_url) {
      return json(res, 400, { ok: false, error: 'missing_cta' });
    }

    try {
      const sb = getSupabaseAdmin();
      const logo_url = await resolveLogoUrl(body);
      const block = await saveSponsorBlock(sb, {
        slot,
        title,
        body: blockBody,
        cta_label,
        cta_url,
        cta_color,
        logo_url,
        company_name,
        active: body.active !== false,
        include_in_emails: isCityPartner ? false : body.include_in_emails !== false,
      });
      return json(res, 200, { ok: true, block, slot, updatedAt: new Date().toISOString() });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'sponsor_save_failed', message: e.message });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
