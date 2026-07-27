/**
 * Insert anonymised events-browse search/filter telemetry.
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');

const MAX_QUERY = 120;
const MAX_LOCATION = 80;
const MAX_TYPES = 12;
const MAX_TYPE_LEN = 40;

function cleanText(raw, max) {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, max);
}

function normalizeQuery(raw) {
  return cleanText(raw, MAX_QUERY).toLowerCase();
}

function normalizeLocation(raw) {
  return cleanText(raw, MAX_LOCATION);
}

function parseBoolFlag(v) {
  return v === true || v === 1 || v === '1' || v === 'true';
}

function parseTypes(raw) {
  const list = Array.isArray(raw)
    ? raw
    : String(raw || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
  const out = [];
  const seen = new Set();
  for (const item of list) {
    const t = cleanText(item, MAX_TYPE_LEN).toLowerCase();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= MAX_TYPES) break;
  }
  return out;
}

function parseOptionalDate(raw) {
  const s = String(raw || '').trim().slice(0, 32);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Shape a safe insert row from a public POST body.
 * Returns { ok: false, error, message } or { ok: true, row }.
 */
function sanitizeBrowseSearchPayload(body) {
  const input = body && typeof body === 'object' ? body : {};
  const queryText = normalizeQuery(input.q || input.query || input.queryText);
  const locationText = normalizeLocation(input.location || input.locationText);
  const types = parseTypes(input.types);
  const inPerson = parseBoolFlag(input.inPerson);
  const online = parseBoolFlag(input.online);
  const freeOnly = parseBoolFlag(input.free || input.freeOnly);
  const fiveStarsOnly = parseBoolFlag(input.fiveStars || input.fiveStarsOnly);
  const dateFrom = parseOptionalDate(input.dateFrom);
  const dateTo = parseOptionalDate(input.dateTo);
  const sort = cleanText(input.sort || '', 40).toLowerCase() || null;
  const priceMin = cleanText(input.priceMin || '', 16) || null;
  const priceMax = cleanText(input.priceMax || '', 16) || null;
  const resultCount = Math.max(0, Math.min(1_000_000, Number(input.resultCount) || 0));
  const zeroResults = resultCount === 0 || parseBoolFlag(input.zeroResults);

  const hasFilterSignal =
    Boolean(queryText) ||
    Boolean(locationText) ||
    types.length > 0 ||
    inPerson ||
    online ||
    freeOnly ||
    fiveStarsOnly ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    Boolean(priceMin) ||
    Boolean(priceMax);

  if (!hasFilterSignal) {
    return { ok: false, error: 'no_signal', message: 'Nothing meaningful to log.' };
  }

  return {
    ok: true,
    row: {
      source: 'events_browse',
      query_text: queryText,
      location_text: locationText,
      filters: {
        types,
        inPerson,
        online,
        freeOnly,
        fiveStarsOnly,
        dateFrom,
        dateTo,
        priceMin,
        priceMax,
        sort,
      },
      result_count: resultCount,
      zero_results: zeroResults,
    },
  };
}

async function recordBrowseSearch(body) {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'not_configured', message: 'Supabase is not configured.' };
  }

  const sanitized = sanitizeBrowseSearchPayload(body);
  if (!sanitized.ok) return sanitized;

  const sb = getSupabaseAdmin();
  const { error } = await sb.from('browse_search_events').insert(sanitized.row);
  if (error) {
    const err = new Error(error.message || 'insert_failed');
    err.code = 'insert_failed';
    throw err;
  }

  return { ok: true };
}

module.exports = {
  sanitizeBrowseSearchPayload,
  recordBrowseSearch,
  normalizeQuery,
  normalizeLocation,
};
