/** Migration 266 review-then-pay queue columns (review_submitted_at, approved_at, …). */

const REVIEW_SUBMITTED_META_KEY = '__review_submitted_at';
const REJECTION_AUTOMATED_META_KEY = '__rejection_automated_at';
const AUTO_REJECTION_NOTE_PREFIXES = [
  'We could not approve this listing because required details are missing',
  'We could not approve this listing because it includes content we do not allow',
];

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
  if (!row) return false;
  const meta = Array.isArray(row.meta) ? row.meta : [];
  for (let i = 0; i < meta.length; i += 1) {
    const item = meta[i] || {};
    if (String(item.key || '') !== REVIEW_SUBMITTED_META_KEY) continue;
    if (String(item.val || '').trim()) return true;
  }
  return false;
}

function effectiveRejectionAutomatedAt(row) {
  if (!row) return null;
  const meta = Array.isArray(row.meta) ? row.meta : [];
  for (let i = 0; i < meta.length; i += 1) {
    const item = meta[i] || {};
    if (String(item.key || '') !== REJECTION_AUTOMATED_META_KEY) continue;
    const val = String(item.val || '').trim();
    if (val) return val;
  }
  return null;
}

function isLikelyAutomatedRejectionNote(note) {
  const text = String(note || '').trim();
  if (!text) return false;
  return AUTO_REJECTION_NOTE_PREFIXES.some(function (prefix) {
    return text.indexOf(prefix) === 0;
  });
}

function isOpportunityAutoRejected(row) {
  if (!row) return false;
  return Boolean(effectiveRejectionAutomatedAt(row) || isLikelyAutomatedRejectionNote(row.rejection_note));
}

function mergeRejectionAutomatedMeta(meta, iso) {
  const at = String(iso || new Date().toISOString()).trim();
  const list = Array.isArray(meta) ? meta.slice() : [];
  let found = false;
  const next = list
    .map(function (item) {
      if (String(item && item.key ? item.key : '') !== REJECTION_AUTOMATED_META_KEY) {
        return item;
      }
      found = true;
      return { key: REJECTION_AUTOMATED_META_KEY, val: at };
    })
    .filter(Boolean);
  if (!found) next.push({ key: REJECTION_AUTOMATED_META_KEY, val: at });
  return next;
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

/** True when a row belongs in the Command Centre review queue. */
function isOpportunityInAdminReviewQueue(row) {
  if (!row) return false;
  if (hasPendingLiveListingUpdate(row)) return true;
  if (String(row.approval_status || '').trim() !== 'Pending Review') return false;
  return isOpportunitySubmittedForReview(row);
}

function filterPendingOpportunityAdminRows(rows) {
  return (rows || []).filter(isOpportunityInAdminReviewQueue);
}

/** Admin pending queue: new submissions + staged edits on live listings. */
function applyPendingOpportunitiesAdminFilter(dbQuery, reviewQueueReady) {
  if (reviewQueueReady) {
    return dbQuery.or(
      'and(approval_status.eq.Pending Review,review_submitted_at.not.is.null),pending_review_payload.not.is.null'
    );
  }
  // Migration 266 missing — meta.__review_submitted_at is filtered in application code.
  return dbQuery.eq('approval_status', 'Pending Review');
}

async function countPendingOpportunitiesForAdmin(sb, reviewQueueReady) {
  void reviewQueueReady;
  if (!sb) return 0;
  const { data, error } = await sb
    .from('business_opportunities')
    .select('id, meta, approval_status, pending_review_payload, review_submitted_at, updated_at')
    .eq('approval_status', 'Pending Review')
    .limit(500);
  if (error) return 0;
  return filterPendingOpportunityAdminRows(data || []).length;
}

function resetOpportunityReviewQueueReadyCache() {
  reviewQueueReadyCache = null;
}

/** Backfill review_submitted_at when only meta / pending_review_payload stamps exist. */
async function healOrphanedOpportunityReviewSubmissions(sb, options) {
  if (!sb) return { healed: 0 };
  const ready = await isOpportunityReviewQueueReady(sb);
  if (!ready) return { healed: 0 };

  const limit = Math.min(Math.max(Number(options && options.limit) || 50, 1), 200);
  const { data, error } = await sb
    .from('business_opportunities')
    .select('id, meta, approval_status, review_submitted_at, pending_review_payload')
    .eq('approval_status', 'Pending Review')
    .is('review_submitted_at', null)
    .limit(limit);
  if (error) {
    console.warn('[opportunity] heal review queue scan failed:', error.message || error);
    return { healed: 0 };
  }

  let healed = 0;
  for (const row of data || []) {
    let at = effectiveReviewSubmittedAt(row);
    const payload = row && row.pending_review_payload;
    if (!at && payload && payload.submittedAt) {
      at = String(payload.submittedAt).trim();
    }
    if (!at) continue;

    const { error: upErr } = await sb
      .from('business_opportunities')
      .update({
        review_submitted_at: at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    if (!upErr) healed += 1;
  }

  if (healed > 0) {
    console.info('[opportunity] healed ' + healed + ' orphaned review submission(s)');
  }
  return { healed };
}

/** Rejected in the last N days by automated moderation (meta stamp or known rejection copy). */
async function listRecentAutoRejectedOpportunities(sb, options) {
  if (!sb) return [];
  const days = Math.min(Math.max(Number(options && options.days) || 7, 1), 30);
  const limit = Math.min(Math.max(Number(options && options.limit) || 20, 1), 50);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from('business_opportunities')
    .select('id, title, host, owner_email, rejection_note, meta, updated_at')
    .eq('approval_status', 'Rejected')
    .gte('updated_at', since)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[opportunity] auto-reject scan failed:', error.message || error);
    return [];
  }
  return (data || []).filter(isOpportunityAutoRejected);
}

module.exports = {
  REVIEW_SUBMITTED_META_KEY,
  REJECTION_AUTOMATED_META_KEY,
  effectiveReviewSubmittedAt,
  effectiveRejectionAutomatedAt,
  isLikelyAutomatedRejectionNote,
  isOpportunityAutoRejected,
  isOpportunitySubmittedForReview,
  mergeReviewSubmittedMeta,
  mergeRejectionAutomatedMeta,
  stampOpportunityReviewSubmission,
  resetOpportunityReviewQueueReadyCache,
  isOpportunityReviewQueueReady,
  applySubmittedReviewFilter,
  hasPendingLiveListingUpdate,
  applyPendingOpportunitiesAdminFilter,
  healOrphanedOpportunityReviewSubmissions,
  listRecentAutoRejectedOpportunities,
  isOpportunityInAdminReviewQueue,
  filterPendingOpportunityAdminRows,
  countPendingOpportunitiesForAdmin,
};
