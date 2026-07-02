/**
 * Paid featured event spotlight carousel — concurrent active listing cap.
 * Keep in sync with SPOTLIGHT_MAX in js/events.js.
 */
const { getSupabaseAdmin } = require('./supabase');
const { isEventCurrentlyFeatured } = require('./event-featured-plans');
const { SPOTLIGHT_CAROUSEL_MAX } = require('./spotlight-carousel-limits');

const BROWSE_VIEW = 'browse_events_index';
const EVENT_FEATURED_SPOTLIGHT_MAX = SPOTLIGHT_CAROUSEL_MAX;

async function listActiveFeaturedEventRows() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from(BROWSE_VIEW)
    .select('id, featured, featured_until')
    .eq('featured', true);
  if (error) throw new Error(error.message);
  return (data || []).filter(isEventCurrentlyFeatured);
}

/** @param {string} [excludeEventId] — extending the same event does not consume an extra slot */
async function getFeaturedSpotlightSlotStatus(excludeEventId) {
  const rows = await listActiveFeaturedEventRows();
  const exclude = String(excludeEventId || '').trim();
  const used = exclude ? rows.filter((r) => r.id !== exclude).length : rows.length;
  const max = EVENT_FEATURED_SPOTLIGHT_MAX;
  return {
    max,
    used,
    available: Math.max(0, max - used),
    full: used >= max,
  };
}

async function assertFeaturedSpotlightSlotAvailable(eventId) {
  const status = await getFeaturedSpotlightSlotStatus(eventId);
  if (!status.full) return status;
  const err = new Error('featured_slots_full');
  err.code = 'featured_slots_full';
  err.slots = status;
  throw err;
}

module.exports = {
  EVENT_FEATURED_SPOTLIGHT_MAX,
  listActiveFeaturedEventRows,
  getFeaturedSpotlightSlotStatus,
  assertFeaturedSpotlightSlotAvailable,
};
