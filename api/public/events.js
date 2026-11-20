/**
 * Public read-only events feed for AI assistants.
 * GET /api/public/events?location=Manchester&limit=10
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('../_lib/supabase');
const { wrapHandler } = require('../_lib/sentry');
const { fetchPublicEventsFeed } = require('../_lib/public-events-feed');
const { siteOrigin } = require('../_lib/hubert-seo');

module.exports = wrapHandler(async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({
      ok: false,
      error: 'not_configured',
      message: 'Events feed unavailable until Supabase is configured.',
      events: [],
    });
  }

  try {
    const sb = getSupabaseAdmin();
    const origin = siteOrigin(process.env.SITE_URL);
    const feed = await fetchPublicEventsFeed(sb, req.query || {}, origin);
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=600');
    return res.status(200).json(feed);
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: 'server_error',
      message: e && e.message ? e.message : 'Could not load events feed.',
      events: [],
    });
  }
});
