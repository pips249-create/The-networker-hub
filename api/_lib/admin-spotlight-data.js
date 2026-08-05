/**
 * Admin spotlight carousel — slot usage across events, opportunities, and organisers.
 */
const { getSupabaseAdmin } = require('./supabase');
const { getFeaturedSpotlightSlotStatus } = require('./event-featured-slots');
const { getPremiumSpotlightSlotStatus } = require('./opportunity-premium-slots');
const { isFeaturedUntilActive } = require('./admin-featured-until');
const { SPOTLIGHT_CAROUSEL_MAX } = require('./spotlight-carousel-limits');

/** Keep in sync with SPOTLIGHT_MAX in js/organisers.js */
const ORGANISER_SPOTLIGHT_MAX = 12;

async function listActiveFeaturedOrganisers(sb) {
  const res = await sb.from('organisers').select('id, featured, featured_until').eq('featured', true);
  if (res.error) throw new Error(res.error.message);
  return (res.data || []).filter(isFeaturedUntilActive);
}

async function getOrganiserSpotlightSlotStatus(sb) {
  const rows = await listActiveFeaturedOrganisers(sb);
  const used = rows.length;
  return {
    max: ORGANISER_SPOTLIGHT_MAX,
    used,
    available: Math.max(0, ORGANISER_SPOTLIGHT_MAX - used),
    full: used >= ORGANISER_SPOTLIGHT_MAX,
  };
}

async function expireFeaturedOrganisers(sb) {
  const client = sb || getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from('organisers')
    .update({ featured: false, featured_until: null })
    .eq('featured', true)
    .not('featured_until', 'is', null)
    .lt('featured_until', now)
    .select('id');
  if (error) throw new Error(error.message);
  return { expired: (data || []).length, ids: (data || []).map((r) => r.id) };
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
  listActiveFeaturedOrganisers,
  getOrganiserSpotlightSlotStatus,
  expireFeaturedOrganisers,
  getAdminSpotlightOverview,
};
