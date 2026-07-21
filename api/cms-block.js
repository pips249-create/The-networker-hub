/**
 * Public CMS block API — Supabase cms_blocks by slot.
 *
 * GET /api/cms-block?slot=sponsor_hub
 */
const { getSupabaseAdmin, isSupabaseConfigured, supabaseConfig } = require('./_lib/supabase');
const {
  normalizeSponsorBlock,
  isPublishableSponsorBlock,
} = require('./_lib/cms-sponsor-fields');
const { cityPartnerSlotKey } = require('./_lib/networking-city-partners');

const LEGACY_SPONSOR_HUB_SLOT = 'sponsor_hub';
const { HOME_PARTNERS_SLOT, parsePartnersBody, publishablePartners } = require('./_lib/home-partners');
const {
  EVENT_PAGE_CAROUSEL_SLOT,
  ORGANISER_PAGE_CAROUSEL_SLOT,
  PAGE_CAROUSEL_SLOTS,
  parseCarouselBody,
  publishableCarouselAds,
} = require('./_lib/event-page-carousel');

/** Browse hero slots — fall back to legacy sponsor_hub if not published separately. */
const HERO_SPONSOR_SLOTS = new Set([
  'events_sponsor_hub',
  'organisers_sponsor_hub',
  'opportunities_sponsor_hub',
  LEGACY_SPONSOR_HUB_SLOT,
]);

/** Detail-page slots fall back to events hero Sponsor Hub when not published separately. */
const DETAIL_PAGE_SLOTS = new Set([
  'event_page_sidebar_ad',
  'organiser_page_sidebar_ad',
  'event_page_banner_ad',
  'opportunity_page_sidebar_ad',
]);

const DETAIL_FALLBACK_CHAINS = {
  opportunity_page_sidebar_ad: [
    'event_page_sidebar_ad',
    'opportunities_sponsor_hub',
    'events_sponsor_hub',
    LEGACY_SPONSOR_HUB_SLOT,
  ],
  event_page_sidebar_ad: ['events_sponsor_hub', LEGACY_SPONSOR_HUB_SLOT],
  organiser_page_sidebar_ad: ['events_sponsor_hub', LEGACY_SPONSOR_HUB_SLOT],
  event_page_banner_ad: ['events_sponsor_hub', LEGACY_SPONSOR_HUB_SLOT],
};

const DEFAULT_DETAIL_FALLBACK_CHAIN = ['events_sponsor_hub', LEGACY_SPONSOR_HUB_SLOT];

async function fetchSlotRow(sb, slotKey) {
  const res = await sb.from('cms_blocks').select('*').eq('slot', slotKey).maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return res.data || null;
}

/** Return a slot row only when it is active and has the minimum content for that placement. */
async function fetchPublishableBlock(sb, slotKey) {
  const row = await fetchSlotRow(sb, slotKey);
  if (isPublishableSponsorBlock(row, slotKey)) return row;
  return null;
}

module.exports = async function handler(req, res) {
  if (String(req.query?.route || '').trim() === 'city-partner') {
    return require('./_lib/routes/city-partner')(req, res);
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');

  let slot = String(req.query?.slot || '').trim();
  const region = String(req.query?.region || '').trim().toLowerCase();
  if (!slot && region) {
    slot = cityPartnerSlotKey(region);
  }
  if (slot === 'networking_city_partner' && region) {
    slot = cityPartnerSlotKey(region);
  }
  if (!slot) {
    return res.status(400).json({ ok: false, error: 'missing_slot' });
  }

  const cfg = supabaseConfig();
  if (!isSupabaseConfigured()) {
    return res.status(200).json({
      ok: false,
      configured: false,
      provider: 'supabase',
      message:
        'Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel, set DATA_PROVIDER=supabase, then Redeploy.',
      envCheck: {
        hasSupabaseUrl: Boolean(cfg.url),
        hasSupabaseServiceKey: Boolean(cfg.serviceKey),
      },
      block: null,
    });
  }

  try {
    const sb = getSupabaseAdmin();

    if (slot === HOME_PARTNERS_SLOT) {
      const row = await fetchSlotRow(sb, slot);
      const sectionActive = row ? row.active !== false : false;
      const partners = sectionActive ? publishablePartners(parsePartnersBody(row?.body)) : [];
      return res.status(200).json({
        ok: true,
        configured: true,
        provider: 'supabase',
        slot,
        active: sectionActive,
        partners,
        block: row ? { ...row, partners } : null,
      });
    }

    if (PAGE_CAROUSEL_SLOTS.has(slot)) {
      const row = await fetchSlotRow(sb, slot);
      const sectionActive = row ? row.active !== false : false;
      const ads = sectionActive ? publishableCarouselAds(parseCarouselBody(row?.body), slot) : [];
      return res.status(200).json({
        ok: true,
        configured: true,
        provider: 'supabase',
        slot,
        active: sectionActive,
        ads,
        block: row ? { ...row, ads } : null,
      });
    }

    let block = await fetchPublishableBlock(sb, slot);
    let fallbackFrom = null;

    if (!block && HERO_SPONSOR_SLOTS.has(slot) && slot !== LEGACY_SPONSOR_HUB_SLOT) {
      block = await fetchPublishableBlock(sb, LEGACY_SPONSOR_HUB_SLOT);
      if (block) fallbackFrom = LEGACY_SPONSOR_HUB_SLOT;
    }

    if (!block && DETAIL_PAGE_SLOTS.has(slot)) {
      const chain = DETAIL_FALLBACK_CHAINS[slot] || DEFAULT_DETAIL_FALLBACK_CHAIN;
      for (const fallbackSlot of chain) {
        block = await fetchPublishableBlock(sb, fallbackSlot);
        if (block) {
          fallbackFrom = fallbackSlot;
          break;
        }
      }
    }

    if (block) block = normalizeSponsorBlock(block);

    return res.status(200).json({
      ok: true,
      configured: true,
      provider: 'supabase',
      slot,
      fallbackFrom,
      block,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      configured: true,
      provider: 'supabase',
      error: 'server_error',
      message: e.message,
    });
  }
};
