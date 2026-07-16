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

module.exports = {
  EVENT_TZ,
  londonWallToUtcIso,
  formatTime,
  formatTimeRange,
  formatDateOnly,
  londonTimeFromIso,
  eventStartMs,
  eventEndMs,
  isEventStarted,
  isEventPast,
};
