/** Migration 266 review-then-pay queue columns (review_submitted_at, approved_at, …). */

const REVIEW_SUBMITTED_META_KEY = '__review_submitted_at';

let reviewQueueReadyCache = null;

function effectiveReviewSubmittedAt(row) {
  if (!row) return null;
  const direct = row.review_submitted_at || row.reviewSubmittedAt || null;
  if (direct) return direct;
  const meta = Array.isArray(row.meta) ? row.meta : [];
  for (let i = 0; i < meta.length; i += 1) {
    const item = meta[i] || {};
    if (String(item.key || '') !== REVIEW_SUBMITTED_META_KEY) continue;
    const val = String(item.val || '').trim();
    if (val) return val;
  }
  return null;
}

function isOpportunitySubmittedForReview(row) {
  return Boolean(effectiveReviewSubmittedAt(row));
}

function mergeReviewSubmittedMeta(meta, iso) {
  const at = String(iso || new Date().toISOString()).trim();
  const list = Array.isArray(meta) ? meta.slice() : [];
  let found = false;
  const next = list
    .map(function (item) {
      if (String(item && item.key ? item.key : '') !== REVIEW_SUBMITTED_META_KEY) {
        return item;
      }
      found = true;
      return { key: REVIEW_SUBMITTED_META_KEY, val: at };
    })
    .filter(Boolean);
  if (!found) next.push({ key: REVIEW_SUBMITTED_META_KEY, val: at });
  return next;
}

function stampOpportunityReviewSubmission(row, iso) {
  const at = String(iso || new Date().toISOString()).trim();
  if (!row || typeof row !== 'object') return at;
  row.review_submitted_at = at;
  row.meta = mergeReviewSubmittedMeta(row.meta, at);
  return at;
}

async function isOpportunityReviewQueueReady(sb) {
  if (reviewQueueReadyCache === true) return true;
  if (!sb) return false;
  const { error } = await sb
    .from('business_opportunities')
    .select('review_submitted_at, approved_at')
    .limit(0);
  if (!error) {
    reviewQueueReadyCache = true;
    return true;
  }
  console.warn(
    '[opportunity] review queue columns missing — run migration 266_opportunity_review_queue_and_pay_reminder.sql'
  );
  return false;
}

function applySubmittedReviewFilter(dbQuery, ready) {
  if (!ready) return dbQuery;
  return dbQuery.not('review_submitted_at', 'is', null);
}

function hasPendingLiveListingUpdate(row) {
  return Boolean(row && row.pending_review_payload && row.pending_review_payload.row);
}

/** Admin pending queue: new submissions + staged edits on live listings. */
function applyPendingOpportunitiesAdminFilter(dbQuery, reviewQueueReady) {
  if (reviewQueueReady) {
    return dbQuery.or(
      'and(approval_status.eq.Pending Review,review_submitted_at.not.is.null),pending_review_payload.not.is.null'
    );
  }
  return dbQuery.not('pending_review_payload', 'is', null);
}

function resetOpportunityReviewQueueReadyCache() {
  reviewQueueReadyCache = null;
}

module.exports = {
  REVIEW_SUBMITTED_META_KEY,
  effectiveReviewSubmittedAt,
  isOpportunitySubmittedForReview,
  mergeReviewSubmittedMeta,
  stampOpportunityReviewSubmission,
  resetOpportunityReviewQueueReadyCache,
  isOpportunityReviewQueueReady,
  applySubmittedReviewFilter,
  hasPendingLiveListingUpdate,
  applyPendingOpportunitiesAdminFilter,
};
