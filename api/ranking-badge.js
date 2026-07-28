/**
 * Public ranking badge SVG for website embeds.
 *
 * GET /api/ranking-badge?tier=top10&period=July%202026
 */
const { buildRankingBadgeSvg, normalizeTier } = require('./_lib/ranking-badge-svg');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'method_not_allowed' }));
  }

  const query = req.query || {};
  const tier = normalizeTier(query.tier || query.badge || 'top50');
  const period = String(query.period || query.periodLabel || query.p || '').trim();
  const svg = buildRankingBadgeSvg({ tier, period });

  res.statusCode = 200;
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="ranking-badge.svg"');
  return res.end(svg);
};
