/**
 * Paginated public event browse — server-side filters for scale.
 */
const { isEventCurrentlyFeatured } = require('./event-featured-plans');
const { SPOTLIGHT_CAROUSEL_MAX } = require('./spotlight-carousel-limits');
const { dedupeFeaturedRowsBySeries } = require('./event-series-peers');
const {
  sanitizeSearchTerm,
  tokenizeSearchQuery,
  searchTermIlikePatterns,
} = require('./search-match');
const {
  outcodeListForLocation,
  haversineMiles,
  bboxForRadiusMiles,
  cityRegionFromInput,
  regionLocationTextFilters,
} = require('./uk-outcode');
const { geocodeUkLocation } = require('./postcode-geocode');
const {
  eventsFromPublishedRows,
  isUpcomingBrowseEvent,
  isApprovedPublicEventPayload,
} = require('./supabase-events');
const { eventImageUrl, normalizeEventImagePosition } = require('./event-image');

const BROWSE_VIEW = 'browse_events_index';
const MAX_LIMIT = 48;
const DEFAULT_LIMIT = 12;
/** Map pins — keep payload under serverless limits as the catalogue grows. */
const MAX_PINS = 800;
/** Max bbox candidates pulled into Node for haversine filter. */
const GEO_MATCH_CAP = 1500;
const IN_CHUNK = 80;
const PIN_SELECT =
  'id, slug, title, city, format_tab, latitude, longitude, starts_at, outcode, min_ticket_price, image_url, photo_url, image_position, event_type, type_tab, featured, featured_until, average_rating, review_count, organiser_id';

const SLIM_RATING_SELECT =
  'id, organiser_id, latitude, longitude, format_tab, starts_at, min_ticket_price, average_rating, review_count, featured, featured_until, created_at';

/** Sorts / filters that must use organiser profile ratings (not per-event averages). */
function needsOrganiserRatingSort(params) {
  return (
    Boolean(params.fiveStarsOnly) ||
    params.sort === 'best-rated' ||
    params.sort === 'rating-desc'
  );
}

function dedupeEventsById(events) {
  const seen = new Set();
  return (events || []).filter((ev) => {
    const id = String(ev?.id || '').trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function applyUpcomingBrowseFilter(query, nowIso) {
  const now = nowIso || new Date().toISOString();
  return query.gt('starts_at', now);
}

function parseBrowseQuery(query) {
  const q = query || {};
  const limit = Math.min(Math.max(parseInt(String(q.limit || ''), 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const page = Math.max(parseInt(String(q.page || ''), 10) || 1, 1);
  const offset =
    q.offset != null
      ? Math.max(parseInt(String(q.offset), 10) || 0, 0)
      : (page - 1) * limit;

  const sortOptions = [
    'recommended',
    'date',
    'price-asc',
    'price-desc',
    'best-rated',
    'newest-added',
  ];

  const types = String(q.type || q.types || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s && s !== 'all');

  const outcodes = String(q.outcodes || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  return {
    limit,
    page,
    offset,
    mode: q.mode === 'pins' ? 'pins' : q.featured === '1' ? 'featured' : 'list',
    includeMeta: q.meta !== '0',
    q: String(q.q || '').trim(),
    types,
    inPerson: q.inPerson !== '0' && q.inPerson !== 'false',
    online: q.online !== '0' && q.online !== 'false',
    freeOnly: q.free === '1' || q.freeOnly === '1',
    fiveStarsOnly: q.fiveStars === '1' || q.fiveStarsOnly === '1',
    priceMin:
      q.priceMin != null && String(q.priceMin).trim() !== ''
        ? Number(q.priceMin)
        : null,
    priceMax:
      q.priceMax != null && String(q.priceMax).trim() !== ''
        ? Number(q.priceMax)
        : null,
    dateFrom: q.dateFrom || null,
    dateTo: q.dateTo || null,
    location: String(q.location || '').trim(),
    outcodes,
    lat: q.lat != null && String(q.lat).trim() !== '' ? Number(q.lat) : null,
    lng: q.lng != null && String(q.lng).trim() !== '' ? Number(q.lng) : null,
    radiusMi:
      q.radius != null && String(q.radius).trim() !== ''
        ? Number(q.radius)
        : q.radiusMi != null
          ? Number(q.radiusMi)
          : null,
    sort: sortOptions.includes(String(q.sort || '')) ? String(q.sort) : 'recommended',
  };
}

function hasGeoRadius(params) {
  return (
    Number.isFinite(params.lat) &&
    Number.isFinite(params.lng) &&
    Number.isFinite(params.radiusMi) &&
    params.radiusMi > 0
  );
}

/** When radius is set without lat/lng, geocode location (full postcode, outcode, or city). */
async function enrichGeoParams(params) {
  if (hasGeoRadius(params)) return params;
  const radiusMi =
    Number.isFinite(params.radiusMi) && params.radiusMi > 0 ? params.radiusMi : null;
  if (!radiusMi || !params.location) return params;

  const geo = await geocodeUkLocation(params.location);
  if (!geo || !Number.isFinite(geo.latitude) || !Number.isFinite(geo.longitude)) {
    return params;
  }
  return {
    ...params,
    lat: geo.latitude,
    lng: geo.longitude,
    radiusMi,
  };
}

function applyFormatFilter(query, params) {
  const wantInPerson = params.inPerson;
  const wantOnline = params.online;
  if (wantInPerson && wantOnline) return query;
  if (!wantInPerson && !wantOnline) {
    return query.eq('id', '00000000-0000-0000-0000-000000000000');
  }
  if (wantInPerson && !wantOnline) {
    return query.eq('format_tab', 'in-person');
  }
  if (!wantInPerson && wantOnline) {
    return query.eq('format_tab', 'online');
  }
  return query;
}

function applySearchFilter(query, params) {
  const terms = tokenizeSearchQuery(params.q);
  if (!terms.length) return query;

  const fields = [
    'title',
    'description',
    'city',
    'venue',
    'location_label',
    'postcode',
    'organiser_name',
    'event_type',
    'meeting_type',
    'format_tab',
  ];

  let next = query;
  terms.forEach((term) => {
    const patterns = searchTermIlikePatterns(term);
    // highlights is text[] — ilike on it throws "operator does not exist: text[] ~~* unknown".
    const orParts = [];
    patterns.forEach((pattern) => {
      fields.forEach((field) => {
        orParts.push(`${field}.ilike.${pattern}`);
      });
    });
    next = next.or(orParts.join(','));
  });
  return next;
}

function applyOutcodeFilter(query, params) {
  if (hasGeoRadius(params)) return query;
  const outcodes = outcodeListForLocation(params.location, params.outcodes);
  if (outcodes && outcodes.length) {
    const ocList = outcodes.length <= 120 ? outcodes : outcodes.slice(0, 120);
    const region = cityRegionFromInput(params.location);
    const orParts = [`outcode.in.(${ocList.join(',')})`];

    if (region) {
      const textFilters = regionLocationTextFilters(region);
      if (textFilters && textFilters.cityName) {
        const cityTerm = sanitizeSearchTerm(textFilters.cityName.toLowerCase());
        if (cityTerm.length >= 3) {
          orParts.push(`city.ilike.%${cityTerm}%`);
          orParts.push(`location_label.ilike.%${cityTerm}%`);
        }
      }
    }

    return query.or(orParts.join(','));
  }

  const raw = params.location;
  if (!raw) return query;
  const region = cityRegionFromInput(raw);
  if (region) return query;
  const terms = tokenizeSearchQuery(raw);
  if (!terms.length) return query;

  let next = query;
  terms.forEach((term) => {
    if (term.length < 3) return;
    const patterns = searchTermIlikePatterns(term);
    const orParts = [];
    patterns.forEach((pattern) => {
      orParts.push(`city.ilike.${pattern}`);
      orParts.push(`location_label.ilike.${pattern}`);
      orParts.push(`venue.ilike.${pattern}`);
    });
    next = next.or(orParts.join(','));
  });
  return next;
}

function applyGeoBboxFilter(query, params) {
  if (!hasGeoRadius(params)) return query;
  const box = bboxForRadiusMiles(params.lat, params.lng, params.radiusMi);
  const minLat = box.minLat.toFixed(6);
  const maxLat = box.maxLat.toFixed(6);
  const minLng = box.minLng.toFixed(6);
  const maxLng = box.maxLng.toFixed(6);
  return query.or(
    `format_tab.eq.online,and(latitude.gte.${minLat},latitude.lte.${maxLat},longitude.gte.${minLng},longitude.lte.${maxLng})`
  );
}

function applyBrowseFilters(query, params) {
  let next = applyUpcomingBrowseFilter(query);

  if (params.types.length) {
    next = next.in('type_tab', params.types);
  }

  next = applyFormatFilter(next, params);
  next = applySearchFilter(next, params);
  next = applyOutcodeFilter(next, params);
  next = applyGeoBboxFilter(next, params);

  if (params.freeOnly) {
    next = next.eq('min_ticket_price', 0);
  } else {
    if (Number.isFinite(params.priceMin) && params.priceMin >= 0) {
      next = next.gte('min_ticket_price', params.priceMin);
    }
    if (Number.isFinite(params.priceMax) && params.priceMax >= 0) {
      next = next.lte('min_ticket_price', params.priceMax);
    }
  }

  if (params.dateFrom) {
    next = next.gte('starts_at', params.dateFrom);
  }
  if (params.dateTo) {
    next = next.lte('starts_at', params.dateTo);
  }

  // fiveStarsOnly uses organiser ratings — applied in Node after attachOrganiserRatings.

  return next;
}

function rowReviewCount(row) {
  const orgReviews = Number(row.organiser_review_count);
  if (Number.isFinite(orgReviews) && orgReviews > 0) return orgReviews;
  return Number(row.review_count) || 0;
}

function rowRatingSortKey(row) {
  const orgReviews = Number(row.organiser_review_count) || 0;
  const orgRating =
    row.organiser_average_rating != null && row.organiser_average_rating !== ''
      ? Number(row.organiser_average_rating)
      : NaN;
  if (orgReviews > 0 && Number.isFinite(orgRating) && orgRating > 0) return orgRating;

  const eventReviews = Number(row.review_count) || 0;
  const eventRating =
    row.average_rating != null && row.average_rating !== '' ? Number(row.average_rating) : NaN;
  if (eventReviews > 0 && Number.isFinite(eventRating) && eventRating > 0) return eventRating;
  return null;
}

function rowPassesFiveStars(row) {
  const rating = rowRatingSortKey(row);
  return rating != null && rating >= 4.5;
}

async function attachOrganiserRatings(sb, rows) {
  const list = rows || [];
  if (!list.length) return list;
  const orgIds = [...new Set(list.map((row) => row.organiser_id).filter(Boolean))];
  if (!orgIds.length) return list;

  const byId = new Map();
  for (let i = 0; i < orgIds.length; i += IN_CHUNK) {
    const chunk = orgIds.slice(i, i + IN_CHUNK);
    const { data, error } = await sb
      .from('organisers')
      .select('id, average_rating, review_count')
      .in('id', chunk);
    if (error) throw new Error(error.message);
    (data || []).forEach((org) => {
      byId.set(org.id, org);
    });
  }

  return list.map((row) => {
    const org = row.organiser_id ? byId.get(row.organiser_id) : null;
    if (!org) return row;
    return {
      ...row,
      organiser_average_rating: org.average_rating,
      organiser_review_count: org.review_count,
    };
  });
}

async function fetchAllMatchingSlim(sb, params, select) {
  const pageSize = 1000;
  const rows = [];
  let from = 0;
  const cap = hasGeoRadius(params) ? GEO_MATCH_CAP : 5000;
  while (from < cap) {
    const to = Math.min(from + pageSize - 1, cap - 1);
    let query = sb
      .from(BROWSE_VIEW)
      .select(select)
      .order('starts_at', { ascending: true })
      .range(from, to);
    query = applyBrowseFilters(query, params);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

function rowAddedSortKey(row) {
  if (!row.created_at) return null;
  const ts = new Date(row.created_at).getTime();
  return Number.isNaN(ts) ? null : ts;
}

function compareRatingDesc(a, b) {
  const rb = rowRatingSortKey(b);
  const ra = rowRatingSortKey(a);
  if (ra == null && rb == null) return 0;
  if (ra == null) return 1;
  if (rb == null) return -1;
  if (rb !== ra) return rb - ra;
  return rowReviewCount(b) - rowReviewCount(a);
}

function sortRows(rows, sort) {
  const list = rows.slice();
  list.sort((a, b) => {
    if (sort === 'best-rated' || sort === 'rating-desc') {
      const byRating = compareRatingDesc(a, b);
      if (byRating !== 0) return byRating;
      return new Date(a.starts_at || 0) - new Date(b.starts_at || 0);
    }
    if (sort === 'newest-added') {
      const cb = rowAddedSortKey(b);
      const ca = rowAddedSortKey(a);
      if (ca == null && cb == null) return 0;
      if (ca == null) return 1;
      if (cb == null) return -1;
      return cb - ca;
    }
    if (sort === 'price-asc') {
      return (Number(a.min_ticket_price) || 0) - (Number(b.min_ticket_price) || 0);
    }
    if (sort === 'price-desc') {
      return (Number(b.min_ticket_price) || 0) - (Number(a.min_ticket_price) || 0);
    }
    if (sort === 'date') {
      return new Date(a.starts_at || 0) - new Date(b.starts_at || 0);
    }
    const af = isEventCurrentlyFeatured(a) ? 1 : 0;
    const bf = isEventCurrentlyFeatured(b) ? 1 : 0;
    if (bf !== af) return bf - af;
    const byRating = compareRatingDesc(a, b);
    if (byRating !== 0) return byRating;
    return new Date(a.starts_at || 0) - new Date(b.starts_at || 0);
  });
  return list;
}

function applySqlSort(query, sort) {
  if (sort === 'date') {
    return query.order('starts_at', { ascending: true, nullsFirst: false });
  }
  if (sort === 'price-asc') {
    return query
      .order('min_ticket_price', { ascending: true })
      .order('starts_at', { ascending: true });
  }
  if (sort === 'price-desc') {
    return query
      .order('min_ticket_price', { ascending: false })
      .order('starts_at', { ascending: true });
  }
  if (sort === 'best-rated' || sort === 'rating-desc') {
    return query
      .order('average_rating', { ascending: false, nullsFirst: false })
      .order('starts_at', { ascending: true });
  }
  if (sort === 'newest-added') {
    return query
      .order('created_at', { ascending: false, nullsFirst: false })
      .order('starts_at', { ascending: true });
  }
  return query
    .order('featured', { ascending: false })
    .order('average_rating', { ascending: false, nullsFirst: true })
    .order('starts_at', { ascending: true, nullsFirst: false });
}

function rowPassesGeo(row, params) {
  if (!hasGeoRadius(params)) return true;
  if (row.format_tab === 'online') return true;
  const lat = row.latitude != null ? Number(row.latitude) : null;
  const lng = row.longitude != null ? Number(row.longitude) : null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return haversineMiles(params.lat, params.lng, lat, lng) <= params.radiusMi;
}

function rowToBrowsePin(row) {
  const lat = row.latitude != null ? Number(row.latitude) : null;
  const lng = row.longitude != null ? Number(row.longitude) : null;
  const priceNum = Number(row.min_ticket_price) || 0;
  const membersOnlyEvent = Boolean(row.members_only_event);
  const startsAt = row.starts_at ? new Date(row.starts_at) : null;
  const dateLine =
    startsAt && !Number.isNaN(startsAt.getTime())
      ? startsAt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
      : 'Date TBC';
  const priceLabel = membersOnlyEvent
    ? 'Members only'
    : priceNum > 0
      ? '£' + priceNum.toFixed(2)
      : 'Free';
  const typeRaw = String(row.event_type || row.type_tab || '').trim();
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    city: row.city,
    format: row.format_tab,
    formatSlug: row.format_tab,
    lat,
    lng,
    mapLat: lat,
    mapLng: lng,
    starts_at: row.starts_at,
    dateRaw: row.starts_at,
    nextDate: row.starts_at,
    date: dateLine,
    dateLine: dateLine,
    priceNum,
    priceKey: membersOnlyEvent ? 'members_only' : priceNum > 0 ? 'paid' : 'free',
    price: priceLabel,
    isMembersOnlyEvent: membersOnlyEvent,
    hasMembersOnlyTiers: membersOnlyEvent,
    attendanceMode: String(row.attendance_mode || '').trim() || 'tickets',
    outcode: row.outcode,
    featured: isEventCurrentlyFeatured(row),
    eventType: typeRaw,
    typeRaw,
    photo: eventImageUrl(row),
    photoPosition: normalizeEventImagePosition(row.image_position),
  };
}

async function fetchMatchingRows(sb, params, select, options) {
  const opts = options || {};
  let query = sb.from(BROWSE_VIEW).select(select);
  query = applyBrowseFilters(query, params);
  if (opts.sort) query = applySqlSort(query, opts.sort);
  else if (hasGeoRadius(params) && !opts.limit) {
    // Prefer sooner events when we must cap geo candidates.
    query = query.order('starts_at', { ascending: true });
  }
  const geoCap = hasGeoRadius(params) ? GEO_MATCH_CAP : null;
  const limit = opts.limit != null ? opts.limit : geoCap;
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchBrowseTypeCounts(sb, params) {
  const types = [
    'meeting',
    'conference',
    'events',
    'exhibition',
    'awards',
    'webinar',
    'workshop',
    'seminar',
    'masterclass',
  ];
  const base = { ...params, types: [] };

  // Geo radius needs haversine in Node — page past PostgREST max-rows (1000).
  if (hasGeoRadius(params)) {
    const pageSize = 1000;
    const rows = [];
    let from = 0;
    while (from < GEO_MATCH_CAP) {
      const to = Math.min(from + pageSize - 1, GEO_MATCH_CAP - 1);
      let query = sb
        .from(BROWSE_VIEW)
        .select('type_tab, latitude, longitude, format_tab')
        .order('starts_at', { ascending: true })
        .range(from, to);
      query = applyBrowseFilters(query, base);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const batch = data || [];
      rows.push(...batch);
      if (batch.length < pageSize) break;
      from += pageSize;
    }
    const filtered = rows.filter((row) => rowPassesGeo(row, params));
    const counts = { all: filtered.length };
    types.forEach((type) => {
      counts[type] = 0;
    });
    filtered.forEach((row) => {
      const type = String(row.type_tab || 'meeting').toLowerCase();
      if (counts[type] != null) counts[type] += 1;
    });
    return counts;
  }

  // Exact SQL counts — avoids silent truncation once the catalogue exceeds max-rows.
  async function countFor(typeList) {
    let query = sb.from(BROWSE_VIEW).select('id', { count: 'exact', head: true });
    query = applyBrowseFilters(query, { ...base, types: typeList });
    const { count, error } = await query;
    if (error) throw new Error(error.message);
    return Number(count) || 0;
  }

  const counts = { all: await countFor([]) };
  await Promise.all(
    types.map(async (type) => {
      counts[type] = await countFor([type]);
    })
  );
  return counts;
}

/**
 * browse_events_index may lag behind new event columns (e.g. image_position).
 * When the view omits the column, pull it from events so cover crops match detail.
 */
async function attachImagePositions(sb, rows) {
  const list = rows || [];
  if (!list.length) return list;
  if (Object.prototype.hasOwnProperty.call(list[0], 'image_position')) return list;

  const ids = list.map((row) => row.id).filter(Boolean);
  const positions = new Map();
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK);
    const { data, error } = await sb.from('events').select('id, image_position').in('id', chunk);
    if (error) throw new Error(error.message);
    (data || []).forEach((row) => {
      positions.set(row.id, row.image_position ?? null);
    });
  }
  return list.map((row) => ({
    ...row,
    image_position: positions.has(row.id) ? positions.get(row.id) : null,
  }));
}

/**
 * Category Exclusivity / guest programme need attendance_mode on browse cards.
 * Older browse_events_index definitions omit the column; hydrate from events.
 */
async function attachAttendanceModes(sb, rows) {
  const list = rows || [];
  if (!list.length) return list;
  if (Object.prototype.hasOwnProperty.call(list[0], 'attendance_mode')) return list;

  const ids = list.map((row) => row.id).filter(Boolean);
  const modes = new Map();
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK);
    const { data, error } = await sb.from('events').select('id, attendance_mode').in('id', chunk);
    if (error) throw new Error(error.message);
    (data || []).forEach((row) => {
      modes.set(row.id, row.attendance_mode || 'tickets');
    });
  }
  return list.map((row) => ({
    ...row,
    attendance_mode: modes.has(row.id) ? modes.get(row.id) : row.attendance_mode || 'tickets',
  }));
}

async function hydrateBrowseEvents(sb, rows) {
  const withPositions = await attachImagePositions(sb, rows);
  const withModes = await attachAttendanceModes(sb, withPositions);
  const published = withModes.map((row) => ({ ...row, next_date: row.starts_at }));
  const mapped = await eventsFromPublishedRows(sb, published, null, { browseList: true });
  return mapped.filter((ev) => isApprovedPublicEventPayload(ev) && isUpcomingBrowseEvent(ev));
}

async function fetchBrowsePageIds(sb, params) {
  const geo = hasGeoRadius(params);
  const ratingSort = needsOrganiserRatingSort(params);

  if (geo || ratingSort) {
    const slim = await fetchAllMatchingSlim(sb, params, SLIM_RATING_SELECT);
    let filtered = geo ? slim.filter((row) => rowPassesGeo(row, params)) : slim;
    if (ratingSort) {
      filtered = await attachOrganiserRatings(sb, filtered);
      if (params.fiveStarsOnly) {
        filtered = filtered.filter(rowPassesFiveStars);
      }
    }
    const sorted = sortRows(filtered, params.sort);
    const total = sorted.length;
    const slice = sorted.slice(params.offset, params.offset + params.limit);
    return { ids: slice.map((r) => r.id), total, rows: slice };
  }

  let query = sb.from(BROWSE_VIEW).select(
    'id, starts_at, min_ticket_price, average_rating, featured, featured_until, created_at',
    { count: 'exact' }
  );
  query = applyBrowseFilters(query, params);
  query = applySqlSort(query, params.sort);
  query = query.range(params.offset, params.offset + params.limit - 1);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  return {
    ids: (data || []).map((r) => r.id),
    total: Number(count) || 0,
    rows: data || [],
  };
}

async function fetchRowsByIds(sb, ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (!unique.length) return [];
  const rows = [];
  for (let i = 0; i < unique.length; i += IN_CHUNK) {
    const chunk = unique.slice(i, i + IN_CHUNK);
    const { data, error } = await sb.from(BROWSE_VIEW).select('*').in('id', chunk);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
  }
  const byId = new Map(rows.map((r) => [r.id, r]));
  return unique.map((id) => byId.get(id)).filter(Boolean);
}

async function fetchBrowseEventsPage(sb, rawQuery) {
  const params = await enrichGeoParams(parseBrowseQuery(rawQuery));

  if (params.mode === 'pins') {
    const pinParams = { ...params, limit: MAX_PINS, offset: 0 };
    const ratingSort = needsOrganiserRatingSort(params);
    let slim;
    if (hasGeoRadius(params)) {
      slim = await fetchMatchingRows(sb, pinParams, PIN_SELECT, {
        limit: Math.min(GEO_MATCH_CAP, MAX_PINS * 2),
      });
      slim = slim.filter((row) => rowPassesGeo(row, params));
    } else if (ratingSort) {
      slim = await fetchAllMatchingSlim(sb, pinParams, PIN_SELECT);
    } else {
      slim = await fetchMatchingRows(sb, pinParams, PIN_SELECT, {
        sort: params.sort,
        limit: MAX_PINS,
      });
    }
    if (ratingSort) {
      slim = await attachOrganiserRatings(sb, slim);
      if (params.fiveStarsOnly) {
        slim = slim.filter(rowPassesFiveStars);
      }
    }
    const sorted = sortRows(slim, params.sort).slice(0, MAX_PINS);
    const withModes = await attachAttendanceModes(sb, sorted);
    return {
      events: withModes.map(rowToBrowsePin),
      pagination: { total: withModes.length, page: 1, limit: MAX_PINS, totalPages: 1 },
      meta: null,
      featured: [],
    };
  }

  const pageData = await fetchBrowsePageIds(sb, params);
  const pageRows = await fetchRowsByIds(sb, pageData.ids);
  const events = dedupeEventsById(await hydrateBrowseEvents(sb, pageRows));

  const order = new Map(pageData.ids.map((id, i) => [id, i]));
  events.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  let featured = [];
  if (params.mode === 'featured' || params.includeMeta) {
    // Spotlight uses location, search, format, dates, and price floor — but not
    // event-type chips, free-only, or max price, so premium stays visible when
    // users refine the grid (Option B: relevant premium).
    let fq = sb.from(BROWSE_VIEW).select('*').eq('featured', true);
    fq = applyBrowseFilters(fq, { ...params, types: [], freeOnly: false, priceMax: null });
    // Over-fetch then series-dedupe so multi-date groups count as one slot (same as admin).
    fq = fq.order('starts_at', { ascending: true }).limit(SPOTLIGHT_CAROUSEL_MAX * 4);
    const { data: featuredRows, error: fErr } = await fq;
    if (fErr) throw new Error(fErr.message);
    const liveFeatured = dedupeFeaturedRowsBySeries(
      (featuredRows || []).filter((row) => isEventCurrentlyFeatured(row))
    ).slice(0, SPOTLIGHT_CAROUSEL_MAX);
    featured = dedupeEventsById(await hydrateBrowseEvents(sb, liveFeatured));
  }

  let meta = null;
  if (params.includeMeta) {
    const { getFeaturedSpotlightSlotStatus } = require('./event-featured-slots');
    const spotlightSlots = await getFeaturedSpotlightSlotStatus();
    meta = {
      typeCounts: await fetchBrowseTypeCounts(sb, params),
      spotlightHasActiveFeatured: spotlightSlots.used > 0,
      spotlightSlots,
    };
  }

  const total = pageData.total;
  const totalPages = Math.max(1, Math.ceil(total / params.limit));

  return {
    events,
    featured: params.mode === 'featured' ? featured : featured,
    pagination: {
      total,
      page: params.page,
      limit: params.limit,
      offset: params.offset,
      totalPages,
    },
    meta,
  };
}

module.exports = {
  parseBrowseQuery,
  fetchBrowseEventsPage,
  BROWSE_VIEW,
};
