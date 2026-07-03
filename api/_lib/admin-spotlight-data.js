/**
 * Admin spotlight carousel — slot usage across events, opportunities, and organisers.
 */
const { getSupabaseAdmin } = require('./supabase');
const { getFeaturedSpotlightSlotStatus } = require('./event-featured-slots');
const { getPremiumSpotlightSlotStatus } = require('./opportunity-premium-slots');
const { SPOTLIGHT_CAROUSEL_MAX } = require('./spotlight-carousel-limits');

/** Keep in sync with SPOTLIGHT_MAX in js/organisers.js */
const ORGANISER_SPOTLIGHT_MAX = 12;

async function getOrganiserSpotlightSlotStatus(sb) {
  const res = await sb
    .from('organisers')
    .select('id', { count: 'exact', head: true })
    .eq('featured', true);
  if (res.error) throw new Error(res.error.message);
  const used = res.count || 0;
  return {
    max: ORGANISER_SPOTLIGHT_MAX,
    used,
    available: Math.max(0, ORGANISER_SPOTLIGHT_MAX - used),
    full: used >= ORGANISER_SPOTLIGHT_MAX,
  };
}

async function getAdminSpotlightOverview() {
  const sb = getSupabaseAdmin();
  const [events, opportunities, organisers] = await Promise.all([
    getFeaturedSpotlightSlotStatus(),
    getPremiumSpotlightSlotStatus(),
    getOrganiserSpotlightSlotStatus(sb),
  ]);
  return {
    slots: { events, opportunities, organisers },
    carouselMax: SPOTLIGHT_CAROUSEL_MAX,
    organiserCarouselMax: ORGANISER_SPOTLIGHT_MAX,
  };
}

module.exports = {
  ORGANISER_SPOTLIGHT_MAX,
  getAdminSpotlightOverview,
};
