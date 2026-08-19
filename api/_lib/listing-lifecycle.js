/**
 * Keep a live listing live when organiser details are saved.
 * Series templates are built in "create" mode (status draft). Applying that
 * patch onto an already-published row took listings off Browse.
 */

function listingStatusOf(row) {
  return String(row?.status || row?.listingStatus || '').toLowerCase();
}

function shouldPreserveListingLifecycle(row) {
  if (!row) return false;
  const status = listingStatusOf(row);
  if (status === 'published' || status === 'unpublished') return true;
  return Boolean(row.published_at || row.publishedAt);
}

function listingLifecycleFields(row) {
  if (!row) return {};
  const fields = {};
  if (row.status != null) fields.status = row.status;
  if (row.approval_status != null) fields.approval_status = row.approval_status;
  if (row.ticket_sales_enabled != null) fields.ticket_sales_enabled = row.ticket_sales_enabled;
  if (row.published_at) fields.published_at = row.published_at;
  return fields;
}

function applyListingLifecyclePreserve(patch, peerRow) {
  const next = { ...(patch || {}) };
  delete next.id;
  delete next.created_at;
  if (shouldPreserveListingLifecycle(peerRow)) {
    Object.assign(next, listingLifecycleFields(peerRow));
  }
  return next;
}

module.exports = {
  listingStatusOf,
  shouldPreserveListingLifecycle,
  listingLifecycleFields,
  applyListingLifecyclePreserve,
};
