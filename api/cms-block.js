/**
 * Public CMS block API — Supabase (active_cms_blocks by slot).
 *
 * GET /api/cms-block?slot=sponsor_hub
 */
const { getSupabaseAdmin, isSupabaseConfigured, supabaseConfig } = require('./_lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=60');

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
    let data = null;
    const viewRes = await sb.from('active_cms_blocks').select('*').eq('slot', slot).maybeSingle();
    if (!viewRes.error) {
      data = viewRes.data;
    } else {
      const msg = String(viewRes.error.message || '').toLowerCase();
      const missingView =
        msg.includes('active_cms_blocks') &&
        (msg.includes('does not exist') || msg.includes('relation') || msg.includes('schema cache'));
      if (!missingView) throw new Error(viewRes.error.message);
      const tableRes = await sb
        .from('cms_blocks')
        .select('*')
        .eq('slot', slot)
        .eq('active', true)
        .maybeSingle();
      if (tableRes.error) throw new Error(tableRes.error.message);
      data = tableRes.data;
    }
    return res.status(200).json({ ok: true, configured: true, provider: 'supabase', block: data || null });
  } catch (e) {
    return res.status(500).json({ ok: false, configured: true, provider: 'supabase', error: 'server_error', message: e.message });
  }
};

