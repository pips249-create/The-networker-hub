/**
 * Public ranking badge SVG/PNG for website embeds + impression logging.
 *
 * Verified awards only:
 *   GET /api/ranking-badge?organiserId=<uuid>&period=August%202026
 * Optional tier / name query params are ignored for entitlement — we serve the
 * tier they earned and the group name from The Networker UK record.
 *
 * Missing / unearned embeds return a muted “not verified / period ended” plaque
 * so hotlinked Top 10 artwork cannot be forged.
 *
 * Dashboard examples: ?demo=1 (sample plaques only).
 */
const { isUuid } = require('./_lib/uuid');
const {
  buildRankingBadgeSvg,
  buildUnearnedRankingBadgeSvg,
  normalizeTier,
} = require('./_lib/ranking-badge-svg');
const { getOrganiserBadgeAward } = require('./_lib/organiser-ranking-snapshot');
const { getSupabaseAdmin, isSupabaseConfigured } = require('./_lib/supabase');

async function resolveOrganiserName(organiserId) {
  if (!organiserId || !isSupabaseConfigured()) return '';
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb.from('organisers').select('name').eq('id', organiserId).maybeSingle();
    return String(data?.name || '').trim();
  } catch {
    return '';
  }
}

async function logImpression(req, query, tier, period, format, verified) {
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
      verified: Boolean(verified),
    });
  } catch {
    /* never fail the badge response on analytics — verified column may not exist yet */
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
      /* ignore */
    }
  }
}

function sendSvg(res, svg, cacheControl) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="ranking-badge.svg"');
  res.setHeader('Cache-Control', cacheControl);
  return res.end(svg);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'method_not_allowed' }));
  }

  const query = req.query || {};
  const requestedTier = normalizeTier(query.tier || query.badge || 'top50');
  const requestedPeriod = String(query.period || query.periodLabel || query.p || '').trim();
  const format = String(query.format || 'svg').trim().toLowerCase();
  const organiserId = String(query.organiserId || query.organiser || query.id || '').trim();
  const queryName = String(
    query.name || query.group || query.groupName || query.organiserName || ''
  ).trim();

  let svg;
  let serveTier = requestedTier;
  let servePeriod = requestedPeriod;
  let verified = false;
  const isDemo = String(query.demo || query.sample || '').trim() === '1';

  if (isDemo) {
    // Dashboard examples only — clearly labelled so they cannot pass as a live award.
    servePeriod = requestedPeriod || 'Example only';
    svg = buildRankingBadgeSvg({
      tier: serveTier,
      period: servePeriod,
      name: queryName || 'Your networking group',
    });
    res.setHeader('X-Hub-Badge-Status', 'demo');
  } else if (!organiserId || !isUuid(organiserId)) {
    svg = buildUnearnedRankingBadgeSvg({
      period: requestedPeriod,
      reason: 'missing_organiser',
    });
    res.setHeader('X-Hub-Badge-Status', 'unverified');
  } else {
    try {
      const award = await getOrganiserBadgeAward(organiserId, requestedPeriod || null);
      if (award && award.tier) {
        verified = true;
        serveTier = normalizeTier(award.tier);
        servePeriod = String(award.periodLabel || requestedPeriod || '').trim();
        const name =
          String(award.organiserName || award.organiser?.name || '').trim() ||
          (await resolveOrganiserName(organiserId)) ||
          queryName;
        svg = buildRankingBadgeSvg({
          tier: serveTier,
          period: servePeriod,
          name,
        });
        res.setHeader('X-Hub-Badge-Status', 'verified');
        res.setHeader('X-Hub-Badge-Tier', serveTier);
        if (servePeriod) res.setHeader('X-Hub-Badge-Period', servePeriod);
      } else {
        svg = buildUnearnedRankingBadgeSvg({
          period: requestedPeriod,
          reason: requestedPeriod ? 'expired' : 'unearned',
        });
        res.setHeader('X-Hub-Badge-Status', requestedPeriod ? 'expired' : 'unearned');
      }
    } catch (err) {
      console.error('[ranking-badge] verify failed', err?.message || err);
      svg = buildUnearnedRankingBadgeSvg({
        period: requestedPeriod,
        reason: 'unverified',
      });
      res.setHeader('X-Hub-Badge-Status', 'error');
    }
  }

  Promise.resolve(
    logImpression(req, query, serveTier, servePeriod, format, verified)
  ).catch(() => {});

  const cacheControl = verified
    ? 'public, max-age=300, stale-while-revalidate=86400'
    : 'public, max-age=60, stale-while-revalidate=600';

  if (format === 'png') {
    res.setHeader('X-Hub-Badge-Png', 'use-client-canvas');
  }

  return sendSvg(res, svg, cacheControl);
};
