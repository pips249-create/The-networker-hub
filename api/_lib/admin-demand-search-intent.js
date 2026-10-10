/**
 * Roll up anonymised browse_search_events rows into city/county/industry/other-term demand.
 */
const { resolveRegionSlug, parseOutcode } = require('./uk-outcode');
const { NETWORKING_COUNTY_SLUGS, NETWORKING_COUNTY_META } = require('./networking-county-sectors');
const { getOpportunityIndustry } = require('./opportunity-industries');

const COUNTY_SLUG_SET = new Set(NETWORKING_COUNTY_SLUGS);
/** Show free-text terms only when they appear more than three times. */
const OTHER_SEARCH_MIN_COUNT = 4;
const OTHER_SEARCH_MIN_LEN = 3;

function bump(map, key, amount) {
  const k = String(key || '').trim();
  if (!k) return;
  map.set(k, (map.get(k) || 0) + (amount || 1));
}

function topFromMap(map, limit) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function regionDisplayName(slug) {
  const s = String(slug || '')
    .trim()
    .toLowerCase();
  if (!s) return '';
  const countyMeta = NETWORKING_COUNTY_META[s];
  if (countyMeta && countyMeta.name) return countyMeta.name;
  try {
    const { getNetworkingRegion } = require('./networking-regions');
    const meta = getNetworkingRegion(s);
    if (meta && meta.name) return String(meta.name).trim();
  } catch (_e) {
    /* ignore */
  }
  return s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function resolveBrowseRowRegion(row) {
  const fromCol = String(row.region_slug || '')
    .trim()
    .toLowerCase();
  if (fromCol) return fromCol;
  const loc = String(row.location_text || '').trim();
  if (loc) {
    const fromLoc = resolveRegionSlug({ location: loc, locationText: loc });
    if (fromLoc) return fromLoc;
  }
  return null;
}

function resolveLocationIntentSlug(row) {
  const fromRow = resolveBrowseRowRegion(row);
  if (fromRow) return fromRow;
  const q = String(row.query_text || '').trim();
  if (!q || q.length > 64) return null;
  if (parseOutcode(q)) return resolveRegionSlug({ location: q, locationText: q, outcode: q });
  return resolveRegionSlug({ location: q, locationText: q });
}

function queryIsLocationTerm(q) {
  const text = String(q || '').trim();
  if (!text) return false;
  if (parseOutcode(text)) return true;
  return !!resolveRegionSlug({ location: text, locationText: text });
}

function parseOpportunityCategories(raw) {
  const list = Array.isArray(raw)
    ? raw
    : String(raw || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
  const out = [];
  const seen = new Set();
  for (const item of list) {
    const id = String(item || '')
      .trim()
      .toLowerCase();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function opportunityIndustryLabel(categoryId) {
  const id = String(categoryId || '')
    .trim()
    .toLowerCase();
  const match = getOpportunityIndustry(id);
  if (match && match.label) return match.label;
  if (!id) return 'Other';
  return id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildSearchIntentRollups(rows) {
  const cityCounts = new Map();
  const countyCounts = new Map();
  const oppIndustryCounts = new Map();
  const otherTermCounts = new Map();

  for (const row of rows || []) {
    const source = String(row.source || 'events_browse').trim() || 'events_browse';
    const intentSlug = resolveLocationIntentSlug(row);
    if (intentSlug) {
      if (COUNTY_SLUG_SET.has(intentSlug)) bump(countyCounts, intentSlug);
      else bump(cityCounts, intentSlug);
    }

    if (source === 'opportunities_browse') {
      const cats = parseOpportunityCategories(row.filters && row.filters.category);
      cats.forEach((cat) => bump(oppIndustryCounts, cat));
    }

    const q = String(row.query_text || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    if (q.length >= OTHER_SEARCH_MIN_LEN && !queryIsLocationTerm(q) && !parseOutcode(q)) {
      bump(otherTermCounts, q);
    }
  }

  const topCities = topFromMap(cityCounts, 15).map((r) => ({
    slug: r.key,
    name: regionDisplayName(r.key),
    count: r.count,
  }));

  const topCounties = topFromMap(countyCounts, 15).map((r) => ({
    slug: r.key,
    name: regionDisplayName(r.key),
    count: r.count,
  }));

  const topOpportunityIndustries = topFromMap(oppIndustryCounts, 15).map((r) => ({
    industry: r.key,
    label: opportunityIndustryLabel(r.key),
    count: r.count,
  }));

  const otherSearchTerms = [...otherTermCounts.entries()]
    .filter(([, count]) => count >= OTHER_SEARCH_MIN_COUNT)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 20)
    .map(([term, count]) => ({ term, count }));

  return { topCities, topCounties, topOpportunityIndustries, otherSearchTerms };
}

module.exports = {
  buildSearchIntentRollups,
  OTHER_SEARCH_MIN_COUNT,
};
