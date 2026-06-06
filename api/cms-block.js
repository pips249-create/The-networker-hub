/**
 * Public CMS block API — Supabase cms_blocks by slot.
 *
 * GET /api/cms-block?slot=sponsor_hub
 */
const { getSupabaseAdmin, isSupabaseConfigured, supabaseConfig } = require('./_lib/supabase');
const { normalizeSponsorBlock } = require('./_lib/cms-sponsor-fields');

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
    const tableRes = await sb
      .from('cms_blocks')
      .select('*')
      .eq('slot', slot)
      .eq('active', true)
      .maybeSingle();
    if (tableRes.error) throw new Error(tableRes.error.message);

    let block = tableRes.data || null;
    if (!block) {
      const viewRes = await sb.from('active_cms_blocks').select('*').eq('slot', slot).maybeSingle();
      if (!viewRes.error) block = viewRes.data || null;
    }

    if (slot === 'sponsor_hub' && block) {
      block = normalizeSponsorBlock(block);
    }

    return res.status(200).json({ ok: true, configured: true, provider: 'supabase', block });
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
