/**
 * Public organiser browse API.
 *
 * GET /api/organisers
 * GET /api/organisers?slug=harbour-city-hosts
 * GET /api/organisers?id=uuid
 */
const { isSupabaseConfigured, supabaseConfig } = require('./_lib/supabase');
const {
  listPublicOrganisers,
  getPublicOrganiserBySlug,
  getPublicOrganiserById,
} = require('./_lib/supabase-organisers-browse');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=60');

  const cfg = supabaseConfig();
  if (!isSupabaseConfigured()) {
    return res.status(200).json({
      configured: false,
      provider: 'supabase',
      message:
        'Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel, set DATA_PROVIDER=supabase, then Redeploy.',
      organisers: [],
      envCheck: {
        hasSupabaseUrl: Boolean(cfg.url),
        hasSupabaseServiceKey: Boolean(cfg.serviceKey),
      },
    });
  }

  try {
    const slug = req.query?.slug;
    const id = req.query?.id;

    if (slug || id) {
      const organiser = slug
        ? await getPublicOrganiserBySlug(slug)
        : await getPublicOrganiserById(id);
      if (!organiser) {
        return res.status(404).json({
          configured: true,
          provider: 'supabase',
          error: 'not_found',
          message: 'This organiser profile is not published.',
          organiser: null,
        });
      }
      return res.status(200).json({ configured: true, provider: 'supabase', organiser });
    }

    const organisers = await listPublicOrganisers();
    return res.status(200).json({ configured: true, provider: 'supabase', organisers });
  } catch (e) {
    return res.status(500).json({
      configured: true,
      provider: 'supabase',
      error: 'server_error',
      message: e.message,
      organisers: [],
    });
  }
};
