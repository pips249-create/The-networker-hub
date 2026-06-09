/**
 * Public CMS block API — Supabase cms_blocks by slot.
 *
 * GET /api/cms-block?slot=sponsor_hub
 */
const { getSupabaseAdmin, isSupabaseConfigured, supabaseConfig } = require('./_lib/supabase');
const { normalizeSponsorBlock } = require('./_lib/cms-sponsor-fields');

const LEGACY_SPONSOR_HUB_SLOT = 'sponsor_hub';

/** Browse hero slots — fall back to legacy sponsor_hub if not published separately. */
const HERO_SPONSOR_SLOTS = new Set([
  'events_sponsor_hub',
  'organisers_sponsor_hub',
  'opportunities_sponsor_hub',
  'academy_sponsor_hub',
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

async function fetchActiveBlock(sb, slotKey) {
  const tableRes = await sb
    .from('cms_blocks')
    .select('*')
    .eq('slot', slotKey)
    .eq('active', true)
    .maybeSingle();
  if (tableRes.error) throw new Error(tableRes.error.message);
  if (tableRes.data) return tableRes.data;

  const viewRes = await sb.from('active_cms_blocks').select('*').eq('slot', slotKey).maybeSingle();
  if (viewRes.error) throw new Error(viewRes.error.message);
  return viewRes.data || null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const slot = String(req.query?.slot || '').trim();
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
    let block = await fetchActiveBlock(sb, slot);
    let fallbackFrom = null;

    if (!block && HERO_SPONSOR_SLOTS.has(slot) && slot !== LEGACY_SPONSOR_HUB_SLOT) {
      block = await fetchActiveBlock(sb, LEGACY_SPONSOR_HUB_SLOT);
      if (block) fallbackFrom = LEGACY_SPONSOR_HUB_SLOT;
    }

    if (!block && DETAIL_PAGE_SLOTS.has(slot)) {
      const chain = DETAIL_FALLBACK_CHAINS[slot] || DEFAULT_DETAIL_FALLBACK_CHAIN;
      for (const fallbackSlot of chain) {
        block = await fetchActiveBlock(sb, fallbackSlot);
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
