const { getSupabaseAdmin } = require('./supabase');
const { calculateFeaturedListingQuote, normalizePlanId } = require('./event-featured-plans');
const {
  fetchSeriesPeerRows,
  seriesFeaturedStartCap,
  seriesFeaturedUntil,
} = require('./event-series-peers');

async function buildFeaturedQuoteForEvent(eventId, planId) {
  const id = String(eventId || '').trim();
  const resolvedPlanId = normalizePlanId(planId);
  const sb = getSupabaseAdmin();
  const { data: rawRow, error } = await sb.from('events').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!rawRow) throw new Error('event_not_found');

  const peers = await fetchSeriesPeerRows(sb, rawRow);
  return calculateFeaturedListingQuote({
    currentUntil: seriesFeaturedUntil(peers) || rawRow.featured_until,
    planId: resolvedPlanId,
    eventStartsAt: seriesFeaturedStartCap(peers) || rawRow.starts_at,
  });
}

module.exports = {
  buildFeaturedQuoteForEvent,
};
