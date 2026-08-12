/**
 * UK event wall-clock times — stored as UTC ISO, displayed in Europe/London.
 */
const EVENT_TZ = 'Europe/London';
const MAX_EVENT_SPAN_MS = 36 * 60 * 60 * 1000;

const TIME_FMT = {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: EVENT_TZ,
};

const DATE_FMT = {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: EVENT_TZ,
};

function partValue(parts, type) {
  const hit = parts.find((p) => p.type === type);
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
    hour,
    minute: Number(partValue(parts, 'minute')),
  };
}

/** Wall clock in London → UTC ISO string. */
function londonWallToUtcIso(year, month, day, hour, minute) {
  let ms = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 4; i++) {
    const p = londonPartsFromMs(ms);
    const diff =
      Date.UTC(year, month - 1, day, hour, minute, 0) -
      Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0);
    if (!diff) break;
    ms += diff;
  }
  return new Date(ms).toISOString();
}

/**
 * Parse an event date/time input to UTC ISO.
 * Timezone-less `YYYY-MM-DDTHH:mm[:ss]` values are UK wall clock (Europe/London),
 * so multi-date series keep the same local start time across BST/GMT.
 * Strings that already include Z or an offset are kept as absolute instants.
 */
function parseEventDateInputToUtcIso(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const wall = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?(?:\.\d+)?$/
  );
  if (wall) {
    const year = Number(wall[1]);
    const month = Number(wall[2]);
    const day = Number(wall[3]);
    const hour = wall[4] != null ? Number(wall[4]) : 0;
    const minute = wall[5] != null ? Number(wall[5]) : 0;
    return londonWallToUtcIso(year, month, day, hour, minute);
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', TIME_FMT);
}

function formatTimeRange(startsAt, endsAt) {
  if (!startsAt) return '';
  const start = formatTime(startsAt);
  if (!start) return '';
  if (!endsAt) return start;
  const end = formatTime(endsAt);
  if (!end) return start;
  return `${start} – ${end}`;
}

function formatDateOnly(startsAt) {
  if (!startsAt) return '';
  const d = new Date(startsAt);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', DATE_FMT);
}

/** Email/PDF helper: long UK date + HH:mm (or Date TBC). */
function formatEventDateTime(startsAt) {
  const starts = startsAt ? new Date(startsAt) : null;
  if (!starts || Number.isNaN(starts.getTime())) {
    return { event_date: 'Date TBC', event_time: '' };
  }
  return {
    event_date: formatDateOnly(startsAt),
    event_time: formatTime(startsAt),
  };
}

/** "Monday, 3 November 2025 at 10:15" in Europe/London. */
function formatDateTimeLong(iso) {
  const { event_date, event_time } = formatEventDateTime(iso);
  if (event_date === 'Date TBC') return '—';
  if (!event_time) return event_date;
  return event_date + ' at ' + event_time;
}

function londonTimeFromIso(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', TIME_FMT).formatToParts(d);
  let hour = partValue(parts, 'hour');
  if (hour === '24') hour = '00';
  const minute = partValue(parts, 'minute');
  return `${hour}:${minute}`;
}

function londonDateKeyFromIso(iso) {
  const parts = londonDatePartsFromIso(iso);
  if (!parts) return '';
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${parts.year}-${month}-${day}`;
}

function londonDatePartsFromIso(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: EVENT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const year = Number(partValue(parts, 'year'));
  const month = Number(partValue(parts, 'month'));
  const day = Number(partValue(parts, 'day'));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return { year, month, day };
}

function eventEndRaw(source) {
  if (!source) return null;
  return (
    source.ends_at ||
    source.endDateRaw ||
    source.endDate ||
    source.starts_at ||
    source.dateFieldRaw ||
    source.dateRaw ||
    source.next_date ||
    source.nextDate ||
    source.date ||
    null
  );
}

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

/** Prefer a same-day ends_at; fall back to starts_at when end looks like series metadata. */
function eventEndMs(source) {
  const startsAt = eventStartRaw(source);
  const endsAt = source && (source.ends_at || source.endDateRaw || source.endDate);
  const startMs = startsAt ? new Date(startsAt).getTime() : NaN;
  const endMs = endsAt ? new Date(endsAt).getTime() : NaN;
  const startOk = Number.isFinite(startMs);
  const endOk = Number.isFinite(endMs);
  if (endOk && startOk && endMs - startMs >= 0 && endMs - startMs <= MAX_EVENT_SPAN_MS) {
    return endMs;
  }
  if (startOk) return startMs + 2 * 60 * 60 * 1000;
  if (endOk) return endMs;
  const fallback = eventEndRaw(source);
  if (!fallback) return null;
  const ms = new Date(fallback).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function eventStartMs(source) {
  const raw = eventStartRaw(source);
  if (!raw) return null;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function isEventStarted(source, at) {
  const start = eventStartMs(source);
  if (start == null) return false;
  const now = at instanceof Date ? at.getTime() : Date.now();
  return start <= now;
}

function isEventPast(source, at) {
  const end = eventEndMs(source);
  if (end == null) return false;
  const now = at instanceof Date ? at.getTime() : Date.now();
  return end <= now;
}

function parseHourMinute(timeStr) {
  const m = String(timeStr || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/**
 * Detect series rows that lost UK wall-clock time across BST/GMT
 * (same UTC clock on every date → London display jumps by an hour).
 * Realign every date to the earliest occurrence's London start/end.
 */
function planSeriesWallClockRealignment(rows) {
  const normalized = (rows || [])
    .map((row) => ({
      id: row && row.id,
      starts_at: row && (row.starts_at || row.date || null),
      ends_at: row && (row.ends_at || row.endDate || null),
    }))
    .filter((row) => row.id && row.starts_at)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  if (normalized.length < 2) {
    return { needsRepair: false, patches: [], canonicalStart: '', canonicalEnd: '' };
  }

  const startWalls = normalized.map((row) => londonTimeFromIso(row.starts_at)).filter(Boolean);
  const endWalls = normalized
    .map((row) => (row.ends_at ? londonTimeFromIso(row.ends_at) : ''))
    .filter(Boolean);
  const startsDiffer = new Set(startWalls).size > 1;
  const endsDiffer = endWalls.length >= 2 && new Set(endWalls).size > 1;
  if (!startsDiffer && !endsDiffer) {
    return { needsRepair: false, patches: [], canonicalStart: '', canonicalEnd: '' };
  }

  const anchor = normalized[0];
  const startParts = parseHourMinute(londonTimeFromIso(anchor.starts_at));
  if (!startParts) {
    return { needsRepair: false, patches: [], canonicalStart: '', canonicalEnd: '' };
  }
  const endParts = anchor.ends_at ? parseHourMinute(londonTimeFromIso(anchor.ends_at)) : null;
  const canonicalStart =
    String(startParts.hour).padStart(2, '0') + ':' + String(startParts.minute).padStart(2, '0');
  const canonicalEnd = endParts
    ? String(endParts.hour).padStart(2, '0') + ':' + String(endParts.minute).padStart(2, '0')
    : '';

  const patches = [];
  for (const row of normalized) {
    const dateParts = londonDatePartsFromIso(row.starts_at);
    if (!dateParts) continue;
    const nextStart = londonWallToUtcIso(
      dateParts.year,
      dateParts.month,
      dateParts.day,
      startParts.hour,
      startParts.minute
    );
    let nextEnd = row.ends_at || null;
    if (endParts) {
      nextEnd = londonWallToUtcIso(
        dateParts.year,
        dateParts.month,
        dateParts.day,
        endParts.hour,
        endParts.minute
      );
    }
    if (nextStart !== row.starts_at || (nextEnd && nextEnd !== row.ends_at)) {
      patches.push({
        id: row.id,
        starts_at: nextStart,
        ends_at: nextEnd,
      });
    }
  }

  return {
    needsRepair: patches.length > 0,
    patches,
    canonicalStart,
    canonicalEnd,
  };
}

module.exports = {
  EVENT_TZ,
  londonWallToUtcIso,
  parseEventDateInputToUtcIso,
  formatTime,
  formatTimeRange,
  formatDateOnly,
  formatEventDateTime,
  formatDateTimeLong,
  londonTimeFromIso,
  londonDateKeyFromIso,
  londonDatePartsFromIso,
  planSeriesWallClockRealignment,
  eventStartMs,
  eventEndMs,
  isEventStarted,
  isEventPast,
};
