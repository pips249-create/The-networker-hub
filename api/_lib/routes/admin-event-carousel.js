const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { resolveImageUrl } = require('../supabase-storage');
const {
  EVENT_PAGE_CAROUSEL_SLOT,
  EVENT_PAGE_CAROUSEL_SIZE,
  EMAIL_MINI_SPONSOR_SLOTS,
  parseCarouselBody,
  serializeCarouselBody,
  normalizeCarouselAdsList,
  hasValidCarouselLogo,
  hasValidCarouselCta,
} = require('../event-page-carousel');

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
  const requested = String(req.query?.slot || '').trim();
  return EMAIL_MINI_SPONSOR_SLOTS.has(requested) ? requested : EVENT_PAGE_CAROUSEL_SLOT;
}

async function fetchCarouselRow(sb, slot) {
  const res = await sb.from('cms_blocks').select('*').eq('slot', slot).maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return res.data || null;
}

async function resolveCarouselLogos(ads, slot) {
  const out = [];
  for (let i = 0; i < ads.length; i++) {
    const ad = { ...ads[i] };
      if (ad.logoBase64) {
        const uploaded = await resolveImageUrl({
          folder: `sponsor-logos/${slot}/${ad.id || 'ad'}`,
          logoUrl: ad.logo_url,
          logoBase64: ad.logoBase64,
          logoMime: ad.logoMime,
          logoFilename: ad.logoFilename,
        });
        if (uploaded) ad.logo_url = uploaded;
        else if (ad.active) {
          throw new Error(`Logo upload failed for ad slot ${(ad.slot_index || 0) + 1}`);
        }
      delete ad.logoBase64;
      delete ad.logoMime;
      delete ad.logoFilename;
    }
    out.push(ad);
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
  const slot = slotFromRequest(req);

  if (req.method === 'GET') {
    try {
      const row = await fetchCarouselRow(sb, slot);
      const ads = normalizeCarouselAdsList(parseCarouselBody(row?.body));
      return json(res, 200, {
        ok: true,
        configured: true,
        slot,
        active: row ? row.active !== false : true,
        ads,
        updatedAt: row?.updated_at || null,
      });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'carousel_load_failed', message: e.message });
    }
  }

  if (req.method === 'POST') {
    const body = parseBody(req);
    let incoming = Array.isArray(body.ads) ? body.ads : [];

    try {
      const existingRow = await fetchCarouselRow(sb, slot);
      const existingAds = normalizeCarouselAdsList(parseCarouselBody(existingRow?.body));
      const existingById = new Map(existingAds.map((ad) => [ad.id, ad]));

      incoming = await resolveCarouselLogos(
        incoming.map((raw, index) => {
          const normalized =
            normalizeCarouselAdsList([raw])[Math.min(index, EVENT_PAGE_CAROUSEL_SIZE - 1)] ||
            normalizeCarouselAdsList([{ id: `event_carousel_${index + 1}`, slot_index: index }])[index];
          const prev = existingById.get(normalized.id);
          if (!normalized.logo_url && prev?.logo_url) {
            normalized.logo_url = prev.logo_url;
          }
          return normalized;
        }),
        slot
      );

      const ads = normalizeCarouselAdsList(incoming).map((ad) => {
        if (
          !ad.active &&
          hasValidCarouselLogo(ad.logo_url) &&
          hasValidCarouselCta(ad.cta_url)
        ) {
          return { ...ad, active: true };
        }
        return ad;
      });

      for (const ad of ads) {
        if (!ad.active) continue;
        if (!hasValidCarouselLogo(ad.logo_url)) {
          return json(res, 400, {
            ok: false,
            error: 'missing_carousel_logo',
            slot: ad.slot_index + 1,
          });
        }
        if (!hasValidCarouselCta(ad.cta_url)) {
          return json(res, 400, {
            ok: false,
            error: 'missing_carousel_link',
            slot: ad.slot_index + 1,
          });
        }
      }

      const hasLiveAds = ads.some((ad) => ad.active);
      const sectionActive = hasLiveAds ? true : body.active !== false;

      const row = {
        slot,
        title: slot === EVENT_PAGE_CAROUSEL_SLOT ? 'Event page carousel ads' : 'Email mini sponsors',
        subtitle: slot === EVENT_PAGE_CAROUSEL_SLOT ? 'Event page carousel ads' : 'Email mini sponsors',
        body: serializeCarouselBody(ads),
        cta_label: 'Enquire now',
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
        slot,
        active: sectionActive,
        ads: normalizeCarouselAdsList(parseCarouselBody(saveRes.data.body)),
        updatedAt: saveRes.data.updated_at,
      });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'carousel_save_failed', message: e.message });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
