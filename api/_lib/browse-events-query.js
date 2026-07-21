/**
 * Paginated public event browse — server-side filters for scale.
 */
const { isEventCurrentlyFeatured } = require('./event-featured-plans');
const { SPOTLIGHT_CAROUSEL_MAX } = require('./spotlight-carousel-limits');
const { outcodeListForLocation, haversineMiles, bboxForRadiusMiles, cityRegionFromInput, regionLocationTextFilters } = require('./uk-outcode');
const {
  eventsFromPublishedRows,
  isUpcomingBrowseEvent,
  isApprovedPublicEventPayload,
} = require('./supabase-events');

const BROWSE_VIEW = 'browse_events_index';
const MAX_LIMIT = 48;
const DEFAULT_LIMIT = 12;
const MAX_PINS = 2500;
const IN_CHUNK = 80;

function applyUpcomingBrowseFilter(query, nowIso) {
  const now = nowIso || new Date().toISOString();
  return query.gt('starts_at', now);
}

function sanitizeSearchTerm(term) {
  return String(term || '')
    .trim()
    .toLowerCase()
    .replace(/[%_,.()\\]/g, '')
    .slice(0, 48);
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
    'rating-asc',
    'rating-desc',
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

function applyFormatFilter(query, params) {
  const wantInPerson = params.inPerson;
  const wantOnline = params.online;
  if (wantInPerson && wantOnline) return query;
  if (!wantInPerson && !wantOnline) {
    return query.eq('id', '00000000-0000-0000-0000-000000000000');
  }
  if (wantInPerson && !wantOnline) {
    return query.in('format_tab', ['in-person', 'hybrid']);
  }
  if (!wantInPerson && wantOnline) {
    return query.in('format_tab', ['online', 'hybrid']);
  }
  return query;
}

function applySearchFilter(query, params) {
  const terms = params.q
    .toLowerCase()
    .split(/\s+/)
    .map(sanitizeSearchTerm)
    .filter(Boolean);
  if (!terms.length) return query;

  let next = query;
  terms.forEach((term) => {
    const t = `%${term}%`;
    next = next.or(
      `title.ilike.${t},description.ilike.${t},city.ilike.${t},venue.ilike.${t},location_label.ilike.${t},postcode.ilike.${t},organiser_name.ilike.${t}`
    );
  });
  return next;
}

function applyOutcodeFilter(query, params) {
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
  const norm = raw.trim().toLowerCase();
  if (norm.length >= 3) {
    const t = `%${sanitizeSearchTerm(norm)}%`;
    return query.or(`city.ilike.${t},location_label.ilike.${t},venue.ilike.${t}`);
  }
  return query;
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

  if (params.fiveStarsOnly) {
    next = next.gte('review_count', 1).gte('average_rating', 4.5);
  }

  return next;
}

function rowRatingSortKey(row) {
  if (row.average_rating == null || row.average_rating === '') return null;
  const rating = Number(row.average_rating);
  return Number.isNaN(rating) ? null : rating;
}

function sortRows(rows, sort) {
  const list = rows.slice();
  list.sort((a, b) => {
    if (sort === 'rating-desc') {
      const rb = rowRatingSortKey(b);
      const ra = rowRatingSortKey(a);
      if (ra == null && rb == null) return 0;
      if (ra == null) return 1;
      if (rb == null) return -1;
      return rb - ra;
    }
    if (sort === 'rating-asc') {
      const ra = rowRatingSortKey(a);
      const rb = rowRatingSortKey(b);
      if (ra == null && rb == null) return 0;
      if (ra == null) return 1;
      if (rb == null) return -1;
      return ra - rb;
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
    const ra = Number(a.average_rating) || 0;
    const rb = Number(b.average_rating) || 0;
    if (rb !== ra) return rb - ra;
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
  if (sort === 'rating-asc') {
    return query
      .order('average_rating', { ascending: true, nullsFirst: false })
      .order('starts_at', { ascending: true });
  }
  if (sort === 'rating-desc') {
    return query
      .order('average_rating', { ascending: false, nullsFirst: false })
      .order('starts_at', { ascending: true });
  }
  return query
    .order('featured', { ascending: false })
    .order('average_rating', { ascending: false, nullsFirst: true })
    .order('starts_at', { ascending: true, nullsFirst: false });
}

function rowPassesGeo(row, params) {
  if (!hasGeoRadius(params)) return true;
  const lat = row.latitude != null ? Number(row.latitude) : null;
  const lng = row.longitude != null ? Number(row.longitude) : null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (row.format_tab === 'online') return true;
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
    outcode: row.outcode,
  };
}

async function fetchMatchingRows(sb, params, select, options) {
  const opts = options || {};
  let query = sb.from(BROWSE_VIEW).select(select);
  query = applyBrowseFilters(query, params);
  if (opts.sort) query = applySqlSort(query, opts.sort);
  if (opts.limit) query = query.limit(opts.limit);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchBrowseTypeCounts(sb, params) {
  const types = ['meeting', 'events', 'exhibition', 'awards', 'webinar', 'workshop', 'masterclass'];
  const base = { ...params, types: [] };
  let query = sb.from(BROWSE_VIEW).select('type_tab, latitude, longitude, format_tab');
  query = applyBrowseFilters(query, base);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data || []).filter((row) => rowPassesGeo(row, params));
  const counts = { all: rows.length };
  types.forEach((type) => {
    counts[type] = 0;
  });
  rows.forEach((row) => {
    const type = String(row.type_tab || 'meeting').toLowerCase();
    if (counts[type] != null) counts[type] += 1;
  });
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

async function hydrateBrowseEvents(sb, rows) {
  const withPositions = await attachImagePositions(sb, rows);
  const published = withPositions.map((row) => ({ ...row, next_date: row.starts_at }));
  const mapped = await eventsFromPublishedRows(sb, published, null, { browseList: true });
  return mapped.filter((ev) => isApprovedPublicEventPayload(ev) && isUpcomingBrowseEvent(ev));
}

async function fetchBrowsePageIds(sb, params) {
  const geo = hasGeoRadius(params);

  if (geo) {
    const slim = await fetchMatchingRows(
      sb,
      params,
      'id, latitude, longitude, format_tab, starts_at, min_ticket_price, average_rating, featured, featured_until'
    );
    const filtered = slim.filter((row) => rowPassesGeo(row, params));
    const sorted = sortRows(filtered, params.sort);
    const total = sorted.length;
    const slice = sorted.slice(params.offset, params.offset + params.limit);
    return { ids: slice.map((r) => r.id), total, rows: slice };
  }

  let query = sb.from(BROWSE_VIEW).select(
    'id, starts_at, min_ticket_price, average_rating, featured, featured_until',
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
  const params = parseBrowseQuery(rawQuery);

  if (params.mode === 'pins') {
    const pinParams = { ...params, limit: MAX_PINS, offset: 0 };
    if (hasGeoRadius(params)) {
      const slim = await fetchMatchingRows(
        sb,
        pinParams,
        'id, slug, title, city, format_tab, latitude, longitude, starts_at, outcode, min_ticket_price, average_rating, featured, featured_until'
      );
      const filtered = slim.filter((row) => rowPassesGeo(row, params));
      const sorted = sortRows(filtered, params.sort);
      return {
        events: sorted.slice(0, MAX_PINS).map(rowToBrowsePin),
        pagination: { total: filtered.length, page: 1, limit: MAX_PINS, totalPages: 1 },
        meta: null,
        featured: [],
      };
    }

    const slim = await fetchMatchingRows(
      sb,
      pinParams,
      'id, slug, title, city, format_tab, latitude, longitude, starts_at, outcode',
      { sort: params.sort, limit: MAX_PINS }
    );
    return {
      events: slim.map(rowToBrowsePin),
      pagination: { total: slim.length, page: 1, limit: MAX_PINS, totalPages: 1 },
      meta: null,
      featured: [],
    };
  }

  const pageData = await fetchBrowsePageIds(sb, params);
  const pageRows = await fetchRowsByIds(sb, pageData.ids);
  const events = await hydrateBrowseEvents(sb, pageRows);

  const order = new Map(pageData.ids.map((id, i) => [id, i]));
  events.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  let featured = [];
  if (params.mode === 'featured' || params.includeMeta) {
    // Spotlight uses location, search, format, dates, and price floor — but not
    // event-type chips, free-only, or max price, so premium stays visible when
    // users refine the grid (Option B: relevant premium).
    let fq = sb.from(BROWSE_VIEW).select('*').eq('featured', true);
    fq = applyBrowseFilters(fq, { ...params, types: [], freeOnly: false, priceMax: null });
    fq = fq.order('starts_at', { ascending: true }).limit(SPOTLIGHT_CAROUSEL_MAX);
    const { data: featuredRows, error: fErr } = await fq;
    if (fErr) throw new Error(fErr.message);
    const liveFeatured = (featuredRows || []).filter((row) => isEventCurrentlyFeatured(row));
    featured = await hydrateBrowseEvents(sb, liveFeatured);
  }

  let meta = null;
  if (params.includeMeta) {
    const { listActiveFeaturedEventRows } = require('./event-featured-slots');
    const activeFeaturedRows = await listActiveFeaturedEventRows();
    meta = {
      typeCounts: await fetchBrowseTypeCounts(sb, params),
      spotlightHasActiveFeatured: activeFeaturedRows.length > 0,
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
