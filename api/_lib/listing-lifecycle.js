/**
 * Keep a live listing live when organiser details are saved.
 * Series templates are built in "create" mode (status draft). Applying that
 * patch onto an already-published row took listings off Browse.
 *
 * Create-mode templates also default missing content (description, venue, …)
 * to null. Applying those nulls onto an existing peer wiped Event details /
 * Link Out listings. Skip empty patch values when the peer already has content.
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

/** DB columns that must not be blanked by a create-mode series template. */
const PEER_CONTENT_KEYS = [
  'description',
  'venue',
  'address',
  'city',
  'postcode',
  'outcode',
  'location_label',
  'region_slug',
  'latitude',
  'longitude',
  'image_url',
  'image_position',
  'photo_url',
  'meeting_link',
  'meeting_platform',
  'meeting_type',
  'event_type',
  'industries',
  'highlights',
  'food_included',
  'max_attendees',
  'attendance_mode',
  'vat_treatment',
  'refund_policy',
  'refund_policy_details',
  'refund_cutoff_days',
];

function isEmptyContentValue(value) {
  if (value == null) return true;
  if (typeof value === 'string' && !value.trim()) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function hasPeerContentValue(value) {
  return !isEmptyContentValue(value);
}

/**
 * Drop null/empty content keys from a series patch when the peer row already
 * has a value — stops Link Out / partial saves wiping description & venue.
 */
function preservePeerContentFields(patch, peerRow) {
  const next = { ...(patch || {}) };
  if (!peerRow) return next;
  for (let i = 0; i < PEER_CONTENT_KEYS.length; i++) {
    const key = PEER_CONTENT_KEYS[i];
    if (!Object.prototype.hasOwnProperty.call(next, key)) continue;
    if (isEmptyContentValue(next[key]) && hasPeerContentValue(peerRow[key])) {
      delete next[key];
    }
  }
  return next;
}

function applyListingLifecyclePreserve(patch, peerRow) {
  const next = preservePeerContentFields({ ...(patch || {}) }, peerRow);
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
  preservePeerContentFields,
  applyListingLifecyclePreserve,
  PEER_CONTENT_KEYS,
};
