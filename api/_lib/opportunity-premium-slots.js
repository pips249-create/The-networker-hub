/**
 * Premium opportunity spotlight carousel — concurrent active listing cap.
 * Keep in sync with SPOTLIGHT_MAX in js/opportunities-page.js (browse carousel).
 */
const { getSupabaseAdmin } = require('./supabase');
const { listingPaymentCurrent } = require('./opportunity-listing-pricing');
const { isNetworkMarketingType } = require('./opportunity-moderation');
const { SPOTLIGHT_CAROUSEL_MAX } = require('./spotlight-carousel-limits');

const OPPORTUNITY_PREMIUM_SPOTLIGHT_MAX = SPOTLIGHT_CAROUSEL_MAX;

function isPremiumSpotlightActiveRow(row) {
  if (!row || !row.featured) return false;
  if (String(row.status || '').toLowerCase() !== 'published') return false;
  if (String(row.approval_status || '') !== 'Approved') return false;
  if (!listingPaymentCurrent(row)) return false;
  // Browse carousel hides network-marketing from Premium Spotlight.
  if (isNetworkMarketingType(row)) return false;
  if (row.featured_until) {
    const until = new Date(row.featured_until).getTime();
    if (!Number.isNaN(until) && until <= Date.now()) return false;
  }
  return true;
}

async function listActivePremiumSpotlightRows() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('business_opportunities')
    .select(
      'id, featured, status, approval_status, type, tags, featured_until, listing_expires_at, published_at, listing_paid_at'
    )
    .eq('featured', true)
    .eq('status', 'published')
    .eq('approval_status', 'Approved');
  if (error) throw new Error(error.message);
  return (data || []).filter(isPremiumSpotlightActiveRow);
}

/** @param {string} [excludeOpportunityId] — renewing the same listing does not consume an extra slot */
async function getPremiumSpotlightSlotStatus(excludeOpportunityId) {
  const rows = await listActivePremiumSpotlightRows();
  const exclude = String(excludeOpportunityId || '').trim();
  const used = exclude ? rows.filter((r) => r.id !== exclude).length : rows.length;
  const max = OPPORTUNITY_PREMIUM_SPOTLIGHT_MAX;
  return {
    max,
    used,
    available: Math.max(0, max - used),
    full: used >= max,
  };
}

async function assertPremiumSpotlightSlotAvailable(opportunityId) {
  const status = await getPremiumSpotlightSlotStatus(opportunityId);
  if (!status.full) return status;
  const err = new Error('premium_slots_full');
  err.code = 'premium_slots_full';
  err.slots = status;
  throw err;
}

module.exports = {
  OPPORTUNITY_PREMIUM_SPOTLIGHT_MAX,
  isPremiumSpotlightActiveRow,
  listActivePremiumSpotlightRows,
  getPremiumSpotlightSlotStatus,
  assertPremiumSpotlightSlotAvailable,
};
