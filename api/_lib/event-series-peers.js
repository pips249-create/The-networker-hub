/**
 * Resolve peers in a recurring / multi-date event series for featured listing logic.
 */
const { isEventStarted } = require('./event-timezone');

const ACTIVE_SERIES_STATUSES = ['draft', 'published', 'unpublished'];

const SERIES_PEER_COLUMNS =
  'id, series_group_id, duplicated_from_event_id, organiser_id, title, status, approval_status, starts_at, recurrence_pattern, recurrence_end_date, featured, featured_until, featured_plan, featured_paid_at, featured_amount_gbp';

function seriesTitleKey(row) {
  return String(row?.title || '')
    .trim()
    .toLowerCase();
}

function isPublishedApprovedRow(row) {
  if (!row) return false;
  if (row.approval_status !== 'Approved') return false;
  return String(row.status || 'published').toLowerCase() === 'published';
}

async function fetchSeriesPeerRows(sb, row) {
  if (!row?.id) return [];
  if (row.duplicated_from_event_id) return [row];

  let peers = [];

  if (row.series_group_id) {
    const { data, error } = await sb
      .from('events')
      .select(SERIES_PEER_COLUMNS)
      .eq('series_group_id', row.series_group_id)
      .in('status', ACTIVE_SERIES_STATUSES);
    if (error) throw new Error(error.message);
    peers = data || [];
  } else {
    const titleKey = seriesTitleKey(row);
    const organiserId = row.organiser_id || '';
    const pattern = String(row.recurrence_pattern || '').trim().toLowerCase();
    const endDate = String(row.recurrence_end_date || '')
      .trim()
      .slice(0, 10);

    if (!titleKey || !organiserId) return [row];

    const { data, error } = await sb
      .from('events')
      .select(SERIES_PEER_COLUMNS)
      .eq('organiser_id', organiserId)
      .in('status', ACTIVE_SERIES_STATUSES);
    if (error) throw new Error(error.message);

    peers = (data || []).filter((peer) => {
      if (seriesTitleKey(peer) !== titleKey) return false;
      if (String(peer.duplicated_from_event_id || '').trim()) return false;
      if (String(peer.series_group_id || '').trim()) return false;
      if (pattern && endDate) {
        return (
          String(peer.recurrence_pattern || '').trim().toLowerCase() === pattern &&
          String(peer.recurrence_end_date || '')
            .trim()
            .slice(0, 10) === endDate
        );
      }
      return true;
    });

    if (peers.length <= 1) return [row];
  }

  const byId = new Map((peers || []).map((peer) => [peer.id, peer]));
  if (row.id && !byId.has(row.id)) byId.set(row.id, row);
  return [...byId.values()];
}

function upcomingBrowseRows(rows, at) {
  return (rows || []).filter(
    (row) => isPublishedApprovedRow(row) && row.starts_at && !isEventStarted(row, at)
  );
}

/** Last upcoming occurrence — featured placement runs until the series leaves browse. */
function seriesFeaturedStartCap(rows) {
  const upcoming = upcomingBrowseRows(rows);
  if (!upcoming.length) return null;
  let maxMs = null;
  for (const row of upcoming) {
    const ms = new Date(row.starts_at).getTime();
    if (!Number.isFinite(ms)) continue;
    if (maxMs == null || ms > maxMs) maxMs = ms;
  }
  return maxMs != null ? new Date(maxMs).toISOString() : null;
}

function isSeriesLiveOnBrowse(rows) {
  return upcomingBrowseRows(rows).length > 0;
}

function seriesFeaturedUntil(rows) {
  let maxMs = null;
  for (const row of rows || []) {
    if (!row?.featured_until) continue;
    const ms = new Date(row.featured_until).getTime();
    if (!Number.isNaN(ms) && (maxMs == null || ms > maxMs)) maxMs = ms;
  }
  return maxMs != null ? new Date(maxMs).toISOString() : null;
}

function seriesSpotlightBucketKey(row) {
  if (!row) return '';
  const seriesGroupId = String(row.series_group_id || '').trim();
  if (seriesGroupId) return 'sg:' + seriesGroupId;
  return 'id:' + String(row.id || '');
}

function dedupeFeaturedRowsBySeries(rows) {
  return takeFirstRowPerSeries(rows).rows;
}

/**
 * Rows should already be in starts_at order. Keeps the first row per series
 * so a recurring listing occupies one spotlight slot, not one per date.
 * @param {object[]} rows
 * @param {number} [max] stop after this many series
 */
function takeFirstRowPerSeries(rows, max) {
  const seen = new Set();
  const out = [];
  const counts = new Map();
  const cap = Number(max);
  const limit = Number.isFinite(cap) && cap > 0 ? cap : Infinity;
  for (const row of rows || []) {
    const key = seriesSpotlightBucketKey(row) || 'id:' + String(row?.id || out.length);
    counts.set(key, (counts.get(key) || 0) + 1);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
    if (out.length >= limit) break;
  }
  return { rows: out, counts };
}

/** Same bucket key as spotlight — one card per recurring listing on browse. */
function seriesBrowseBucketKey(row) {
  return seriesSpotlightBucketKey(row);
}

function countBrowseSeriesOccurrences(rows) {
  const counts = new Map();
  for (const row of rows || []) {
    const key = seriesBrowseBucketKey(row);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

/**
 * Accidental republishes: same organiser, title, and starts_at (not a multi-date series).
 * Prefer the bookable / priced card so browse does not show Enquire + £15 twins.
 */
function browseSameSlotKey(row) {
  const organiserId = String(row?.organiser_id || '').trim();
  const title = seriesTitleKey(row);
  const startsAt = String(row?.starts_at || '').trim();
  if (!organiserId || !title || !startsAt) return '';
  return organiserId + '\0' + title + '\0' + startsAt;
}

function browseSameSlotQuality(row) {
  if (!row) return -1;
  let score = 0;
  const rawPrice = row.min_ticket_price;
  const hasPrice = rawPrice != null && rawPrice !== '';
  if (hasPrice) score += 100;
  if (Number(rawPrice) > 0) score += 20;
  const checkout = String(row.checkout_mode || '').trim().toLowerCase();
  if (checkout === 'external_link' || checkout === 'external') score += 15;
  if (String(row.external_booking_url || '').trim()) score += 10;
  if (String(row.image_url || row.photo_url || '').trim()) score += 5;
  if (row.featured) score += 25;
  return score;
}

/**
 * Within each same-slot group, keep the highest-quality row at the first
 * group's position in the already-sorted list.
 */
function collapseBrowseSameSlotDuplicates(rows) {
  const list = rows || [];
  if (list.length < 2) return list;

  const bestByKey = new Map();
  const firstIndexByKey = new Map();
  for (let i = 0; i < list.length; i++) {
    const row = list[i];
    const key = browseSameSlotKey(row);
    if (!key) continue;
    if (!firstIndexByKey.has(key)) firstIndexByKey.set(key, i);
    const existing = bestByKey.get(key);
    if (!existing || browseSameSlotQuality(row) > browseSameSlotQuality(existing)) {
      bestByKey.set(key, row);
    }
  }
  if (!bestByKey.size) return list;

  const out = [];
  const emitted = new Set();
  for (let i = 0; i < list.length; i++) {
    const row = list[i];
    const key = browseSameSlotKey(row);
    if (!key) {
      out.push(row);
      continue;
    }
    if (emitted.has(key)) continue;
    if (firstIndexByKey.get(key) !== i) continue;
    emitted.add(key);
    out.push(bestByKey.get(key) || row);
  }
  return out;
}

/** Rows must already be sorted — keeps the first (best) row per series for the active sort. */
function dedupeBrowseRowsBySeries(rows) {
  return dedupeFeaturedRowsBySeries(collapseBrowseSameSlotDuplicates(rows));
}

function seriesCountForRow(row, seriesCounts) {
  if (!row || !seriesCounts) return 1;
  return seriesCounts.get(seriesBrowseBucketKey(row)) || 1;
}

function idToSeriesCountMap(rows, seriesCounts) {
  const out = new Map();
  for (const row of rows || []) {
    if (!row?.id) continue;
    out.set(row.id, seriesCountForRow(row, seriesCounts));
  }
  return out;
}

function attachBrowseSeriesCounts(events, idToSeriesCount) {
  if (!idToSeriesCount || !events?.length) return events;
  for (const ev of events) {
    const count = idToSeriesCount.get(ev.id);
    if (count > 1) {
      ev.seriesOccurrenceCount = count;
      ev.isSeriesBrowse = true;
    }
  }
  return events;
}

module.exports = {
  fetchSeriesPeerRows,
  upcomingBrowseRows,
  seriesFeaturedStartCap,
  isSeriesLiveOnBrowse,
  seriesFeaturedUntil,
  seriesSpotlightBucketKey,
  seriesBrowseBucketKey,
  browseSameSlotKey,
  browseSameSlotQuality,
  collapseBrowseSameSlotDuplicates,
  dedupeFeaturedRowsBySeries,
  takeFirstRowPerSeries,
  countBrowseSeriesOccurrences,
  dedupeBrowseRowsBySeries,
  idToSeriesCountMap,
  attachBrowseSeriesCounts,
};
