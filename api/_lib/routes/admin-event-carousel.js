const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { resolveImageUrl } = require('../supabase-storage');
const {
  EVENT_PAGE_CAROUSEL_SLOT,
  ORGANISER_PAGE_CAROUSEL_SLOT,
  OPPORTUNITY_PAGE_CAROUSEL_SLOT,
  PAGE_CAROUSEL_SLOTS,
  EVENT_PAGE_CAROUSEL_SIZE,
  carouselSize,
  EMAIL_MINI_SPONSOR_SLOTS,
  parseCarouselBody,
  serializeCarouselBody,
  normalizeCarouselAd,
  normalizeCarouselAdsList,
  hasValidCarouselLogo,
  hasValidCarouselCta,
} = require('../event-page-carousel');

function carouselTitle(slot) {
  if (slot === EVENT_PAGE_CAROUSEL_SLOT) return 'Event page carousel ads';
  if (slot === ORGANISER_PAGE_CAROUSEL_SLOT) return 'Organiser page carousel ads';
  if (slot === OPPORTUNITY_PAGE_CAROUSEL_SLOT) return 'Opportunity page carousel ads';
  if (slot === 'events_browse_carousel_ads') return 'Events directory advert carousel';
  return 'Email mini sponsors';
}

function slotFromRequest(req) {
  const requested = String(req.query?.slot || '').trim();
  if (PAGE_CAROUSEL_SLOTS.has(requested) || EMAIL_MINI_SPONSOR_SLOTS.has(requested)) {
    return requested;
  }
  return EVENT_PAGE_CAROUSEL_SLOT;
}

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

async function fetchCarouselRow(sb, slot) {
  const res = await sb.from('cms_blocks').select('*').eq('slot', slot).maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return res.data || null;
}

function looksLikeDirectImageUrl(url) {
  const u = String(url || '').trim();
  if (!u) return false;
  if (/\/storage\/v1\/object\/public\//i.test(u)) return true;
  if (/\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(u)) return true;
  if (/(?:cloudinary\.com|imgix\.net|googleusercontent\.com|twimg\.com|fbcdn\.net)/i.test(u)) {
    return true;
  }
  return false;
}

function isHostedCarouselLogoUrl(url) {
  return /\/storage\/v1\/object\/public\//i.test(String(url || '').trim());
}

async function resolveCarouselLogos(ads, slot, previousAds) {
  const prevById = new Map((Array.isArray(previousAds) ? previousAds : []).map((ad) => [ad.id, ad]));
  const out = [];
  for (let i = 0; i < ads.length; i++) {
    const ad = { ...ads[i] };
    const folder = `sponsor-logos/${slot}/${ad.id || 'ad'}`;
    const logoUrl = String(ad.logo_url || '').trim();
    const hasUpload = Boolean(ad.logoBase64) || /^data:image\//i.test(logoUrl);
    const hasRemoteUrl = /^https?:\/\//i.test(logoUrl);
    const slotLabel = (ad.slot_index || 0) + 1;
    const prev = prevById.get(ad.id) || previousAds?.[ad.slot_index];
    const prevLogo = String(prev?.logo_url || '').trim();
    const logoUnchanged = Boolean(logoUrl && prevLogo && logoUrl === prevLogo);

    /* Already on our CDN, or an unchanged previously-saved URL — do not re-fetch.
       Re-importing every active slot blocked saves when editing a different card. */
    if (!hasUpload && (isHostedCarouselLogoUrl(logoUrl) || (logoUnchanged && hasRemoteUrl))) {
      delete ad.logoBase64;
      delete ad.logoMime;
      delete ad.logoFilename;
      out.push(ad);
      continue;
    }

    if (
      ad.active &&
      hasRemoteUrl &&
      !hasUpload &&
      !looksLikeDirectImageUrl(logoUrl)
    ) {
      const err = new Error(
        'Ad slot ' +
          slotLabel +
          ': logo must be an uploaded image file (PNG/JPG under 2MB), not a website homepage link. Use Choose file.'
      );
      err.code = 'carousel_logo_not_image';
      throw err;
    }

    if (hasUpload || (hasRemoteUrl && looksLikeDirectImageUrl(logoUrl))) {
      try {
        const uploaded = await resolveImageUrl({
          folder,
          logoUrl: ad.logo_url,
          logoBase64: ad.logoBase64 || (/^data:image\//i.test(logoUrl) ? logoUrl : ''),
          logoMime: ad.logoMime,
          logoFilename: ad.logoFilename,
          /* Only re-host new/changed direct image URLs — never fetch HTML homepages. */
          mirrorExternal: hasRemoteUrl && !hasUpload && looksLikeDirectImageUrl(logoUrl),
        });
        if (uploaded) ad.logo_url = uploaded;
        else if (ad.active && hasUpload) {
          throw new Error('Logo upload failed for ad slot ' + slotLabel);
        }
      } catch (e) {
        if (hasUpload && ad.active) throw e;
        if (ad.active && /web page|not an image|fetch logo|Could not fetch/i.test(String(e.message || ''))) {
          const err = new Error(
            'Ad slot ' +
              slotLabel +
              ': could not import that logo link. Download the image and use Choose file (max 2MB).'
          );
          err.code = 'carousel_logo_import_failed';
          throw err;
        }
        /* Keep existing remote URL when re-host is optional / inactive. */
      }
    }

    delete ad.logoBase64;
    delete ad.logoMime;
    delete ad.logoFilename;
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
      const ads = normalizeCarouselAdsList(parseCarouselBody(row?.body), slot);
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
      const existingAds = normalizeCarouselAdsList(parseCarouselBody(existingRow?.body), slot);
      const existingById = new Map(existingAds.map((ad) => [ad.id, ad]));

      incoming = await resolveCarouselLogos(
        incoming.map((raw, index) => {
          const normalized = normalizeCarouselAd(raw, index, slot);
          const size = carouselSize(slot);
          const slotIndex = Math.min(
            Math.max(
              Number.isFinite(Number(raw?.slot_index)) ? Number(raw.slot_index) : index,
              0
            ),
            size - 1
          );
          normalized.slot_index = slotIndex;
          /* normalizeCarouselAd strips upload fields — put them back before resolve. */
          if (raw?.logoBase64) normalized.logoBase64 = raw.logoBase64;
          if (raw?.logoMime) normalized.logoMime = raw.logoMime;
          if (raw?.logoFilename) normalized.logoFilename = raw.logoFilename;
          const prev = existingById.get(normalized.id) || existingAds[slotIndex];
          const hasFreshUpload =
            Boolean(normalized.logoBase64) || /^data:image\//i.test(String(normalized.logo_url || ''));
          /* Never restore the previous logo when the editor just uploaded a new file. */
          if (!hasFreshUpload && !normalized.logo_url && prev?.logo_url) {
            normalized.logo_url = prev.logo_url;
          }
          if (!normalized.company_name && prev?.company_name) {
            normalized.company_name = prev.company_name;
          }
          if (!normalized.cta_color && prev?.cta_color) {
            normalized.cta_color = prev.cta_color;
          }
          if (!normalized.contact_email && prev?.contact_email) {
            normalized.contact_email = prev.contact_email;
          }
          return normalized;
        }),
        slot,
        existingAds
      );

      const ads = normalizeCarouselAdsList(incoming, slot).map((ad) => {
        /* Only auto-activate a filled card when company, logo and link are all present. */
        if (
          !ad.active &&
          String(ad.company_name || '').trim() &&
          hasValidCarouselLogo(ad.logo_url) &&
          hasValidCarouselCta(ad.cta_url)
        ) {
          return { ...ad, active: true };
        }
        return ad;
      });

      for (const ad of ads) {
        if (!ad.active) continue;
        if (!String(ad.company_name || '').trim()) {
          return json(res, 400, {
            ok: false,
            error: 'missing_carousel_company',
            slot: ad.slot_index + 1,
            message:
              'Ad slot ' +
              (ad.slot_index + 1) +
              ' is active — add the company name in that slot, then save again.',
          });
        }
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
        title: carouselTitle(slot),
        subtitle: carouselTitle(slot),
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
        ads: normalizeCarouselAdsList(parseCarouselBody(saveRes.data.body), slot),
        updatedAt: saveRes.data.updated_at,
      });
    } catch (e) {
      const code = e.code || 'carousel_save_failed';
      const status =
        code === 'carousel_logo_not_image' || code === 'carousel_logo_import_failed' ? 400 : 500;
      return json(res, status, {
        ok: false,
        error: code,
        message: e.message || 'Could not save carousel.',
      });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
