/**
 * UK event wall-clock times — stored as UTC ISO, displayed in Europe/London.
 */
(function (global) {
  const EVENT_TZ = 'Europe/London';

  const TIME_FMT = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: EVENT_TZ,
  };

  function partValue(parts, type) {
    const hit = parts.find(function (p) {
      return p.type === type;
    });
    return hit ? hit.value : '';
  }

  function londonPartsFromMs(ms) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: EVENT_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(new Date(ms));
    let hour = Number(partValue(parts, 'hour'));
    if (hour === 24) hour = 0;
    return {
      year: Number(partValue(parts, 'year')),
      month: Number(partValue(parts, 'month')),
      day: Number(partValue(parts, 'day')),
      hour: hour,
      minute: Number(partValue(parts, 'minute')),
    };
  }

  function londonWallToUtcIso(year, month, day, hour, minute) {
    var ms = Date.UTC(year, month - 1, day, hour, minute, 0);
    for (var i = 0; i < 4; i++) {
      var p = londonPartsFromMs(ms);
      var diff =
        Date.UTC(year, month - 1, day, hour, minute, 0) -
        Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0);
      if (!diff) break;
      ms += diff;
    }
    return new Date(ms).toISOString();
  }

  function formatTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-GB', TIME_FMT);
  }

  function formatTimeRange(startsAt, endsAt) {
    if (!startsAt) return '';
    var start = formatTime(startsAt);
    if (!start) return '';
    if (!endsAt) return start;
    var end = formatTime(endsAt);
    if (!end) return start;
    return start + ' \u2013 ' + end;
  }

  function londonTimeFromIso(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    var parts = new Intl.DateTimeFormat('en-GB', TIME_FMT).formatToParts(d);
    var hour = partValue(parts, 'hour');
    if (hour === '24') hour = '00';
    return hour + ':' + partValue(parts, 'minute');
  }

  function londonDateKeyFromIso(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    var parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: EVENT_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    var year = partValue(parts, 'year');
    var month = partValue(parts, 'month');
    var day = partValue(parts, 'day');
    if (!year || !month || !day) return '';
    return year + '-' + month + '-' + day;
  }

  function londonDatePartsFromIso(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    var parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: EVENT_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    var year = Number(partValue(parts, 'year'));
    var month = Number(partValue(parts, 'month'));
    var day = Number(partValue(parts, 'day'));
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    return { year: year, month: month, day: day };
  }

  var MAX_EVENT_SPAN_MS = 36 * 60 * 60 * 1000;

  function eventStartRaw(source) {
    if (!source) return null;
    return (
      source.starts_at ||
      source.dateFieldRaw ||
      source.dateRaw ||
      source.next_date ||
      source.nextDate ||
      source.date ||
      null
    );
  }

  function eventEndMs(source) {
    var startsAt = eventStartRaw(source);
    var endsAt = source && (source.ends_at || source.endDateRaw || source.endDate);
    var startMs = startsAt ? new Date(startsAt).getTime() : NaN;
    var endMs = endsAt ? new Date(endsAt).getTime() : NaN;
    var startOk = Number.isFinite(startMs);
    var endOk = Number.isFinite(endMs);
    if (endOk && startOk && endMs - startMs >= 0 && endMs - startMs <= MAX_EVENT_SPAN_MS) {
      return endMs;
    }
    if (startOk) return startMs + 2 * 60 * 60 * 1000;
    if (endOk) return endMs;
    return null;
  }

  function eventStartMs(source) {
    var raw = eventStartRaw(source);
    if (!raw) return null;
    var ms = new Date(raw).getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  function isEventStarted(source, at) {
    var start = eventStartMs(source);
    if (start == null) return false;
    var now = at instanceof Date ? at.getTime() : Date.now();
    return start <= now;
  }

  function isEventPast(source, at) {
    var end = eventEndMs(source);
    if (end == null) return false;
    var now = at instanceof Date ? at.getTime() : Date.now();
    return end <= now;
  }

  global.HubEventTimezone = {
    EVENT_TZ: EVENT_TZ,
    londonWallToUtcIso: londonWallToUtcIso,
    formatTime: formatTime,
    formatTimeRange: formatTimeRange,
    londonTimeFromIso: londonTimeFromIso,
    londonDateKeyFromIso: londonDateKeyFromIso,
    londonDatePartsFromIso: londonDatePartsFromIso,
    eventStartMs: eventStartMs,
    eventEndMs: eventEndMs,
    isEventStarted: isEventStarted,
    isEventPast: isEventPast,
  };
})(typeof window !== 'undefined' ? window : globalThis);
