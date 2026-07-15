/**
 * City Partner — availability and manual application policy.
 *
 * Mounted at GET/POST /api/city-partner via cms-block rewrite
 * (keeps serverless function count within Vercel Hobby limits).
 */
const { getSupabaseAdmin, isSupabaseConfigured, supabaseConfig } = require('../supabase');
const {
  getCityPartnerAvailability,
  calculateCityPartnerQuote,
  normalizeCitySlugs,
} = require('../networking-city-partners');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const cfg = supabaseConfig();
  if (!isSupabaseConfigured()) {
    return res.status(200).json({
      ok: false,
      configured: false,
      message:
        'Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel, set DATA_PROVIDER=supabase, then Redeploy.',
      envCheck: {
        hasSupabaseUrl: Boolean(cfg.url),
        hasSupabaseServiceKey: Boolean(cfg.serviceKey),
      },
    });
  }

  try {
    const sb = getSupabaseAdmin();
    const availability = await getCityPartnerAvailability(sb);

    if (req.method === 'GET') {
      const slugs = normalizeCitySlugs(req.query?.cities || req.query?.city || '');
      const quote =
        slugs.length > 0 ? calculateCityPartnerQuote(slugs.length) : null;
      return res.status(200).json({
        ok: true,
        configured: true,
        ...availability,
        quote,
      });
    }

    if (req.method === 'POST') {
      return res.status(405).json({
        ok: false,
        error: 'manual_application_required',
        message:
          'City Partner applications are reviewed before payment. Email rosie@thenetworkerhub.com to apply.',
      });
    }

    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: 'server_error',
      message: e.message,
    });
  }
};
