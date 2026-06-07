/**
 * Public CMS block API — Supabase cms_blocks by slot.
 *
 * GET /api/cms-block?slot=sponsor_hub
 */
const { getSupabaseAdmin, isSupabaseConfigured, supabaseConfig } = require('./_lib/supabase');
const { normalizeSponsorBlock } = require('./_lib/cms-sponsor-fields');

const SPONSOR_HUB_SLOT = 'sponsor_hub';

/** Detail-page slots fall back to Sponsor Hub when not published separately. */
const DETAIL_PAGE_SLOTS = new Set([
  'event_page_sidebar_ad',
  'organiser_page_sidebar_ad',
  'event_page_banner_ad',
]);

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

    if (!block && DETAIL_PAGE_SLOTS.has(slot) && slot !== SPONSOR_HUB_SLOT) {
      block = await fetchActiveBlock(sb, SPONSOR_HUB_SLOT);
      if (block) fallbackFrom = SPONSOR_HUB_SLOT;
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
