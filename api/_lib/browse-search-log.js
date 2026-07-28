/**
 * Insert anonymised browse search/filter telemetry (events, organisers, opportunities).
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { resolveRegionSlug } = require('./uk-outcode');

const MAX_QUERY = 120;
const MAX_LOCATION = 80;
const MAX_TYPES = 12;
const MAX_TYPE_LEN = 40;
const MAX_SOURCE = 40;

const ALLOWED_SOURCES = new Set([
  'events_browse',
  'organisers_browse',
  'opportunities_browse',
]);

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

function normalizeSource(raw) {
  const s = cleanText(raw, MAX_SOURCE).toLowerCase().replace(/\s+/g, '_');
  if (ALLOWED_SOURCES.has(s)) return s;
  return 'events_browse';
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

function sanitizeExtraFilters(input, source) {
  const base = {
    types: parseTypes(input.types),
    inPerson: parseBoolFlag(input.inPerson),
    online: parseBoolFlag(input.online),
    freeOnly: parseBoolFlag(input.free || input.freeOnly),
    fiveStarsOnly: parseBoolFlag(input.fiveStars || input.fiveStarsOnly),
    dateFrom: parseOptionalDate(input.dateFrom),
    dateTo: parseOptionalDate(input.dateTo),
    priceMin: cleanText(input.priceMin || '', 16) || null,
    priceMax: cleanText(input.priceMax || '', 16) || null,
    sort: cleanText(input.sort || '', 40).toLowerCase() || null,
  };

  if (source === 'organisers_browse') {
    return {
      ...base,
      tab: cleanText(input.tab || '', 40).toLowerCase() || null,
      hasListings: parseBoolFlag(input.hasListings),
      guestVisits: parseBoolFlag(input.guestVisits),
    };
  }

  if (source === 'opportunities_browse') {
    return {
      ...base,
      category: cleanText(input.category || '', 40).toLowerCase() || null,
      invest: cleanText(input.invest || '', 40).toLowerCase() || null,
      commitment: cleanText(input.commitment || '', 80).toLowerCase() || null,
      locationTag: cleanText(input.locationTag || '', 40).toLowerCase() || null,
    };
  }

  return base;
}

/**
 * Shape a safe insert row from a public POST body.
 * Returns { ok: false, error, message } or { ok: true, row }.
 */
function sanitizeBrowseSearchPayload(body) {
  const input = body && typeof body === 'object' ? body : {};
  const source = normalizeSource(input.source);
  const queryText = normalizeQuery(input.q || input.query || input.queryText);
  const locationText = normalizeLocation(input.location || input.locationText);
  const filters = sanitizeExtraFilters(input, source);
  const resultCount = Math.max(0, Math.min(1_000_000, Number(input.resultCount) || 0));
  const zeroResults = resultCount === 0 || parseBoolFlag(input.zeroResults);
  const regionSlug =
    resolveRegionSlug({
      regionSlug: input.regionSlug || input.region_slug || input.region,
      location: locationText,
      locationText,
      city: locationText,
      outcode: input.outcode,
      postcode: input.postcode,
    }) || null;

  const hasFilterSignal =
    Boolean(queryText) ||
    Boolean(locationText) ||
    Boolean(regionSlug) ||
    (filters.types && filters.types.length > 0) ||
    filters.inPerson ||
    filters.online ||
    filters.freeOnly ||
    filters.fiveStarsOnly ||
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo) ||
    Boolean(filters.priceMin) ||
    Boolean(filters.priceMax) ||
    Boolean(filters.tab && filters.tab !== 'all') ||
    filters.hasListings ||
    filters.guestVisits ||
    Boolean(filters.category) ||
    Boolean(filters.invest && filters.invest !== 'all') ||
    Boolean(filters.commitment) ||
    Boolean(filters.locationTag);

  if (!hasFilterSignal) {
    return { ok: false, error: 'no_signal', message: 'Nothing meaningful to log.' };
  }

  return {
    ok: true,
    row: {
      source,
      query_text: queryText,
      location_text: locationText,
      region_slug: regionSlug,
      filters,
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
  let { error } = await sb.from('browse_search_events').insert(sanitized.row);
  if (error && /region_slug/i.test(String(error.message || ''))) {
    const fallback = { ...sanitized.row };
    delete fallback.region_slug;
    ({ error } = await sb.from('browse_search_events').insert(fallback));
  }
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
  ALLOWED_SOURCES,
};
