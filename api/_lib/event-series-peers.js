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

function upcomingBrowseRows(rows) {
  return (rows || []).filter(
    (row) => isPublishedApprovedRow(row) && row.starts_at && !isEventStarted(row)
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
  const seen = new Set();
  const out = [];
  for (const row of rows || []) {
    const key = seriesSpotlightBucketKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
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

/** Rows must already be sorted — keeps the first (best) row per series for the active sort. */
function dedupeBrowseRowsBySeries(rows) {
  return dedupeFeaturedRowsBySeries(rows);
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
  dedupeFeaturedRowsBySeries,
  countBrowseSeriesOccurrences,
  dedupeBrowseRowsBySeries,
  idToSeriesCountMap,
  attachBrowseSeriesCounts,
};
