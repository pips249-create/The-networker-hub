/**
 * My Events list: which archived rows stay visible.
 * Events that ended in the last 14 days stay on the list while Hide archived
 * is checked, so an organiser can still open yesterday's event.
 * Search and the Archived status show older rows.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) root.organiserEventListVisibility = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var DAY_MS = 24 * 60 * 60 * 1000;
  var RECENTLY_ENDED_MS = 14 * DAY_MS;
  var SAME_OCCURRENCE_MS = 36 * 60 * 60 * 1000;

  function occurrenceAnchorMs(ev) {
    if (!ev) return null;
    var startRaw = ev.date || ev.startsAt || ev.starts_at || ev.eventDate || null;
    var endRaw = ev.endDate || ev.endsAt || ev.ends_at || null;
    var startMs = startRaw ? new Date(startRaw).getTime() : NaN;
    var endMs = endRaw ? new Date(endRaw).getTime() : NaN;
    var startOk = !isNaN(startMs);
    var endOk = !isNaN(endMs);
    if (endOk && startOk && endMs - startMs >= 0 && endMs - startMs <= SAME_OCCURRENCE_MS) {
      return endMs;
    }
    if (startOk) return startMs;
    if (endOk) return endMs;
    return null;
  }

  function eventEndedRecently(ev, nowMs) {
    if (ev && ev.seriesEvents && ev.seriesEvents.length) {
      for (var i = 0; i < ev.seriesEvents.length; i++) {
        if (eventEndedRecently(ev.seriesEvents[i], nowMs)) return true;
      }
      return false;
    }
    var anchor = occurrenceAnchorMs(ev);
    if (anchor == null) return false;
    var now = nowMs == null ? Date.now() : nowMs;
    return anchor <= now && now - anchor <= RECENTLY_ENDED_MS;
  }

  /**
   * @param {{ hideArchived?: boolean, status?: string, search?: string, isArchived?: boolean, event?: object, nowMs?: number }} opts
   */
  function shouldHideArchivedRow(opts) {
    var o = opts || {};
    if (!o.hideArchived) return false;
    if (String(o.status || 'all') === 'archived') return false;
    if (String(o.search || '').trim()) return false;
    if (!o.isArchived) return false;
    if (eventEndedRecently(o.event, o.nowMs)) return false;
    return true;
  }

  return {
    RECENTLY_ENDED_MS: RECENTLY_ENDED_MS,
    occurrenceAnchorMs: occurrenceAnchorMs,
    eventEndedRecently: eventEndedRecently,
    shouldHideArchivedRow: shouldHideArchivedRow,
  };
});
