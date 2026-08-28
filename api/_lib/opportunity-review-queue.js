/** Migration 266 review-then-pay queue columns (review_submitted_at, approved_at, …). */

let reviewQueueReadyCache = null;

async function isOpportunityReviewQueueReady(sb) {
  if (reviewQueueReadyCache !== null) return reviewQueueReadyCache;
  if (!sb) {
    reviewQueueReadyCache = false;
    return false;
  }
  const { error } = await sb
    .from('business_opportunities')
    .select('review_submitted_at, approved_at')
    .limit(0);
  reviewQueueReadyCache = !error;
  if (!reviewQueueReadyCache) {
    console.warn(
      '[opportunity] review queue columns missing — run migration 266_opportunity_review_queue_and_pay_reminder.sql'
    );
  }
  return reviewQueueReadyCache;
}

function applySubmittedReviewFilter(dbQuery, ready) {
  if (!ready) return dbQuery;
  return dbQuery.not('review_submitted_at', 'is', null);
}

module.exports = {
  isOpportunityReviewQueueReady,
  applySubmittedReviewFilter,
};
