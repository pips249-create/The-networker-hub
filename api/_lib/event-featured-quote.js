const { getSupabaseAdmin } = require('./supabase');
const { calculateFeaturedListingQuote, resolveOfferablePlanId } = require('./event-featured-plans');
const { getFeaturedSpotlightSlotStatus } = require('./event-featured-slots');
const {
  fetchSeriesPeerRows,
  seriesFeaturedStartCap,
  seriesFeaturedUntil,
} = require('./event-series-peers');

async function buildFeaturedQuoteForEvent(eventId, planId) {
  const id = String(eventId || '').trim();
  const sb = getSupabaseAdmin();
  const { data: rawRow, error } = await sb.from('events').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!rawRow) throw new Error('event_not_found');

  const peers = await fetchSeriesPeerRows(sb, rawRow);
  const eventStartsAt = seriesFeaturedStartCap(peers) || rawRow.starts_at;
  const resolvedPlanId = resolveOfferablePlanId(planId, eventStartsAt);
  const slots = await getFeaturedSpotlightSlotStatus(id);
  return calculateFeaturedListingQuote({
    currentUntil: seriesFeaturedUntil(peers) || rawRow.featured_until,
    planId: resolvedPlanId,
    eventStartsAt,
    slotsAvailable: slots.available,
  });
}

module.exports = {
  buildFeaturedQuoteForEvent,
};
