/**
 * Paid featured event spotlight carousel — concurrent active listing cap.
 * Keep in sync with SPOTLIGHT_MAX in js/events.js.
 */
const { getSupabaseAdmin } = require('./supabase');
const { isEventCurrentlyFeatured } = require('./event-featured-plans');
const { SPOTLIGHT_CAROUSEL_MAX } = require('./spotlight-carousel-limits');
const { takeFirstRowPerSeries } = require('./event-series-peers');

const BROWSE_VIEW = 'browse_events_index';
const EVENT_FEATURED_SPOTLIGHT_MAX = SPOTLIGHT_CAROUSEL_MAX;
const FEATURED_PAGE_SIZE = 200;
const FEATURED_PAGE_HARD_CAP = 8000;

/**
 * Walk upcoming featured rows in start order and keep one row per series.
 * A long series must not fill the window and hide every other listing.
 * @param {object} sb
 * @param {{ select?: string, maxSeries?: number, applyQuery?: (query: object) => object }} [options]
 */
async function pageUpcomingFeaturedSeries(sb, options = {}) {
  const client = sb || getSupabaseAdmin();
  const select =
    options.select ||
    'id, featured, featured_until, starts_at, series_group_id, organiser_id, title';
  const maxSeries = Number(options.maxSeries);
  const cap = Number.isFinite(maxSeries) && maxSeries > 0 ? maxSeries : null;
  const now = new Date().toISOString();
  const collected = [];
  let from = 0;

  while (from < FEATURED_PAGE_HARD_CAP) {
    let query = client.from(BROWSE_VIEW).select(select).eq('featured', true).gt('starts_at', now);
    if (typeof options.applyQuery === 'function') query = options.applyQuery(query);
    query = query.order('starts_at', { ascending: true }).range(from, from + FEATURED_PAGE_SIZE - 1);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const batch = data || [];
    for (const row of batch) {
      if (isEventCurrentlyFeatured(row)) collected.push(row);
    }
    const picked = takeFirstRowPerSeries(collected, cap);
    if (cap && picked.rows.length >= cap) return picked;
    if (batch.length < FEATURED_PAGE_SIZE) return takeFirstRowPerSeries(collected, cap);
    from += FEATURED_PAGE_SIZE;
  }

  return takeFirstRowPerSeries(collected, cap);
}

async function listActiveFeaturedEventRows() {
  const sb = getSupabaseAdmin();
  const pack = await pageUpcomingFeaturedSeries(sb);
  return pack.rows;
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
  pageUpcomingFeaturedSeries,
  listActiveFeaturedEventRows,
  getFeaturedSpotlightSlotStatus,
  assertFeaturedSpotlightSlotAvailable,
};
