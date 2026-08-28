/**
 * Public monthly organiser ranking leaderboard.
 *
 * GET /api/rankings
 */
const { json, setCors } = require('./_lib/auth');
const { wrapHandler } = require('./_lib/sentry');
const { isSupabaseConfigured, supabaseConfig } = require('./_lib/supabase');
const {
  getPublicRankingLeaderboard,
  getBadgeImpressionCounts,
} = require('./_lib/organiser-ranking-snapshot');

module.exports = wrapHandler(async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  const cfg = supabaseConfig();
  if (!isSupabaseConfigured()) {
    return json(res, 200, {
      ok: true,
      configured: false,
      snapshot: null,
      entries: [],
      message:
        'Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel, set DATA_PROVIDER=supabase, then Redeploy.',
      envCheck: {
        hasSupabaseUrl: Boolean(cfg.url),
        hasSupabaseServiceKey: Boolean(cfg.serviceKey),
      },
    });
  }

  try {
    const report = await getPublicRankingLeaderboard();
    const impressionIds = String(req.query?.impressions || req.query?.organiserIds || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    let badgeImpressions = null;
    if (impressionIds.length) {
      badgeImpressions = await getBadgeImpressionCounts(impressionIds);
    }
    return json(res, 200, {
      ok: true,
      ...report,
      ...(badgeImpressions ? { badgeImpressions } : {}),
    });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: 'rankings_failed',
      message: e.message || 'Could not load rankings.',
    });
  }
});