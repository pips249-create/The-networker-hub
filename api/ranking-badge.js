/**
 * Public ranking badge SVG/PNG for website embeds + impression logging.
 *
 * GET /api/ranking-badge?tier=top10&period=July%202026&organiserId=...&format=svg
 */
const {
  buildRankingBadgeSvg,
  normalizeTier,
} = require('./_lib/ranking-badge-svg');
const { getSupabaseAdmin, isSupabaseConfigured } = require('./_lib/supabase');

async function logImpression(req, query, tier, period, format) {
  if (!isSupabaseConfigured()) return;
  try {
    const sb = getSupabaseAdmin();
    const organiserId = String(query.organiserId || query.organiser || query.id || '').trim() || null;
    await sb.from('ranking_badge_impressions').insert({
      tier,
      period_label: period || '',
      organiser_id: organiserId,
      format: format === 'png' ? 'png' : 'svg',
      referrer: String(req.headers.referer || req.headers.referrer || '').slice(0, 500) || null,
      user_agent: String(req.headers['user-agent'] || '').slice(0, 400) || null,
    });
  } catch {
    /* never fail the badge response on analytics */
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'method_not_allowed' }));
  }

  const query = req.query || {};
  const tier = normalizeTier(query.tier || query.badge || 'top50');
  const period = String(query.period || query.periodLabel || query.p || '').trim();
  const format = String(query.format || 'svg').trim().toLowerCase();
  const svg = buildRankingBadgeSvg({ tier, period });

  // Fire-and-forget analytics
  Promise.resolve(logImpression(req, query, tier, period, format)).catch(() => {});

  if (format === 'png') {
    // No sharp dependency — return SVG with a hint header; clients convert via canvas.
    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('X-Hub-Badge-Png', 'use-client-canvas');
    res.setHeader('Content-Disposition', 'inline; filename="ranking-badge.svg"');
    return res.end(svg);
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="ranking-badge.svg"');
  return res.end(svg);
};
