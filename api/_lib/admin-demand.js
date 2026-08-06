/**
 * Command Centre Demand insights — browse intent + favourites + opportunities + guest visits.
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');

function parsePeriod(raw) {
  const p = String(raw || '30d').trim().toLowerCase();
  return p === '7d' || p === '30d' || p === 'ytd' || p === '12m' || p === 'all' ? p : '30d';
}

function sinceIso(period) {
  if (period === 'all') return null;
  if (period === 'ytd') {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString();
  }
  if (period === '12m') {
    return new Date(Date.now() - 365 * 86400000).toISOString();
  }
  const days = period === '7d' ? 7 : 30;
  return new Date(Date.now() - days * 86400000).toISOString();
}

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

function applySince(query, column, since) {
  return since ? query.gte(column, since) : query;
}

async function fetchAllPages(buildPage) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildPage(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function aggregateBrowseSearches(sb, since) {
  const selectCols =
    'source, query_text, location_text, region_slug, filters, result_count, zero_results, created_at';
  let rows;
  try {
    rows = await fetchAllPages((from, to) =>
      applySince(
        sb
          .from('browse_search_events')
          .select(selectCols)
          .order('created_at', { ascending: false }),
        'created_at',
        since
      ).range(from, to)
    );
  } catch (e) {
    if (!/region_slug/i.test(String(e.message || ''))) throw e;
    rows = await fetchAllPages((from, to) =>
      applySince(
        sb
          .from('browse_search_events')
          .select('source, query_text, location_text, filters, result_count, zero_results, created_at')
          .order('created_at', { ascending: false }),
        'created_at',
        since
      ).range(from, to)
    );
  }

  const queryStats = new Map();
  const locationCounts = new Map();
  const regionCounts = new Map();
  const sourceCounts = new Map();
  const typeCounts = new Map();
  let withQuery = 0;
  let zeroResults = 0;

  for (const row of rows) {
    const q = String(row.query_text || '').trim();
    const loc = String(row.location_text || '').trim();
    const region = String(row.region_slug || '').trim();
    const source = String(row.source || 'events_browse').trim() || 'events_browse';
    const zero = !!row.zero_results || Number(row.result_count) === 0;
    if (zero) zeroResults += 1;
    bump(sourceCounts, source);
    if (q) {
      withQuery += 1;
      const prev = queryStats.get(q) || { count: 0, zeroCount: 0, resultSum: 0 };
      prev.count += 1;
      if (zero) prev.zeroCount += 1;
      prev.resultSum += Number(row.result_count) || 0;
      queryStats.set(q, prev);
    }
    if (loc) bump(locationCounts, loc);
    if (region) bump(regionCounts, region);
    const types = Array.isArray(row.filters?.types) ? row.filters.types : [];
    types.forEach((t) => bump(typeCounts, t));
  }

  const topQueries = [...queryStats.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .slice(0, 15)
    .map(([query, stats]) => ({
      query,
      count: stats.count,
      zeroCount: stats.zeroCount,
      avgResults: stats.count ? Math.round(stats.resultSum / stats.count) : 0,
    }));

  const zeroResultQueries = [...queryStats.entries()]
    .filter(([, stats]) => stats.zeroCount > 0)
    .sort((a, b) => b[1].zeroCount - a[1].zeroCount || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([query, stats]) => ({ query, count: stats.zeroCount }));

  return {
    totalLogged: rows.length,
    withQuery,
    zeroResults,
    topQueries,
    zeroResultQueries,
    topLocations: topFromMap(locationCounts, 10).map((r) => ({ location: r.key, count: r.count })),
    topRegions: topFromMap(regionCounts, 10).map((r) => ({ region: r.key, count: r.count })),
    bySource: topFromMap(sourceCounts, 10).map((r) => ({ source: r.key, count: r.count })),
    topTypes: topFromMap(typeCounts, 10).map((r) => ({ type: r.key, count: r.count })),
  };
}

async function aggregateFavourites(sb, since) {
  const [eventFavs, orgFavs, oppFavs] = await Promise.all([
    fetchAllPages((from, to) =>
      applySince(
        sb.from('event_favourites').select('event_id, created_at').order('created_at', { ascending: false }),
        'created_at',
        since
      ).range(from, to)
    ),
    fetchAllPages((from, to) =>
      applySince(
        sb
          .from('organiser_favourites')
          .select('organiser_id, created_at')
          .order('created_at', { ascending: false }),
        'created_at',
        since
      ).range(from, to)
    ),
    fetchAllPages((from, to) =>
      applySince(
        sb
          .from('opportunity_favourites')
          .select('opportunity_id, created_at')
          .order('created_at', { ascending: false }),
        'created_at',
        since
      ).range(from, to)
    ),
  ]);

  const eventCounts = new Map();
  const orgCounts = new Map();
  const oppCounts = new Map();
  eventFavs.forEach((r) => bump(eventCounts, r.event_id));
  orgFavs.forEach((r) => bump(orgCounts, r.organiser_id));
  oppFavs.forEach((r) => bump(oppCounts, r.opportunity_id));

  const topEventIds = topFromMap(eventCounts, 8).map((r) => r.key);
  const topOrgIds = topFromMap(orgCounts, 8).map((r) => r.key);
  const topOppIds = topFromMap(oppCounts, 8).map((r) => r.key);

  const [eventsRes, orgsRes, oppsRes] = await Promise.all([
    topEventIds.length
      ? sb.from('events').select('id, title, city').in('id', topEventIds)
      : Promise.resolve({ data: [], error: null }),
    topOrgIds.length
      ? sb.from('organisers').select('id, name').in('id', topOrgIds)
      : Promise.resolve({ data: [], error: null }),
    topOppIds.length
      ? sb.from('business_opportunities').select('id, title').in('id', topOppIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (eventsRes.error) throw new Error(eventsRes.error.message);
  if (orgsRes.error) throw new Error(orgsRes.error.message);
  if (oppsRes.error) throw new Error(oppsRes.error.message);

  const eventTitles = new Map((eventsRes.data || []).map((e) => [e.id, e]));
  const orgNames = new Map((orgsRes.data || []).map((o) => [o.id, o]));
  const oppTitles = new Map((oppsRes.data || []).map((o) => [o.id, o]));

  return {
    eventsSaved: eventFavs.length,
    organisersSaved: orgFavs.length,
    opportunitiesSaved: oppFavs.length,
    topEvents: topFromMap(eventCounts, 8).map((r) => {
      const ev = eventTitles.get(r.key) || {};
      return {
        id: r.key,
        title: String(ev.title || '').trim() || '—',
        city: String(ev.city || '').trim() || '',
        saves: r.count,
      };
    }),
    topOrganisers: topFromMap(orgCounts, 8).map((r) => {
      const org = orgNames.get(r.key) || {};
      return {
        id: r.key,
        name: String(org.name || '').trim() || '—',
        saves: r.count,
      };
    }),
    topOpportunities: topFromMap(oppCounts, 8).map((r) => {
      const opp = oppTitles.get(r.key) || {};
      return {
        id: r.key,
        title: String(opp.title || '').trim() || '—',
        saves: r.count,
      };
    }),
  };
}

async function aggregateOpportunities(sb, since) {
  const [enquiries, savedSearches, viewedRes] = await Promise.all([
    fetchAllPages((from, to) =>
      applySince(
        sb
          .from('opportunity_enquiries')
          .select('id, opportunity_id, status, created_at')
          .order('created_at', { ascending: false }),
        'created_at',
        since
      ).range(from, to)
    ),
    fetchAllPages((from, to) =>
      applySince(
        sb
          .from('opportunity_saved_searches')
          .select('id, criteria, created_at')
          .order('created_at', { ascending: false }),
        'created_at',
        since
      ).range(from, to)
    ),
    sb
      .from('business_opportunities')
      .select('id, title, view_count, status')
      .order('view_count', { ascending: false })
      .limit(10),
  ]);

  if (viewedRes.error) throw new Error(viewedRes.error.message);

  const enquiryByOpp = new Map();
  let enquiriesNew = 0;
  for (const row of enquiries) {
    bump(enquiryByOpp, row.opportunity_id);
    if (String(row.status || '') === 'new') enquiriesNew += 1;
  }

  const topEnquiryOppIds = topFromMap(enquiryByOpp, 8).map((r) => r.key);
  const enquiryTitlesRes = topEnquiryOppIds.length
    ? await sb.from('business_opportunities').select('id, title').in('id', topEnquiryOppIds)
    : { data: [], error: null };
  if (enquiryTitlesRes.error) throw new Error(enquiryTitlesRes.error.message);
  const enquiryTitles = new Map((enquiryTitlesRes.data || []).map((o) => [o.id, o]));

  const savedTerms = new Map();
  const savedTypes = new Map();
  for (const row of savedSearches) {
    const criteria = row.criteria && typeof row.criteria === 'object' ? row.criteria : {};
    const q = String(criteria.q || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    if (q) bump(savedTerms, q);
    const type = String(criteria.type || '').trim().toLowerCase();
    if (type && type !== 'all') bump(savedTypes, type);
  }

  return {
    enquiriesTotal: enquiries.length,
    enquiriesNew,
    topEnquired: topFromMap(enquiryByOpp, 8).map((r) => {
      const opp = enquiryTitles.get(r.key) || {};
      return {
        id: r.key,
        title: String(opp.title || '').trim() || '—',
        enquiries: r.count,
      };
    }),
    topViewed: (viewedRes.data || [])
      .filter((o) => Number(o.view_count) > 0)
      .slice(0, 8)
      .map((o) => ({
        id: o.id,
        title: String(o.title || '').trim() || '—',
        viewCount: Number(o.view_count) || 0,
        status: o.status || '',
      })),
    savedSearchTerms: topFromMap(savedTerms, 10).map((r) => ({ query: r.key, count: r.count })),
    savedSearchTypes: topFromMap(savedTypes, 8).map((r) => ({ type: r.key, count: r.count })),
    savedSearchesTotal: savedSearches.length,
  };
}

async function aggregateGuestVisits(sb, since) {
  const rows = await fetchAllPages((from, to) =>
    applySince(
      sb
        .from('registrations')
        .select('id, attendee_id, created_at, registration_kind')
        .eq('registration_kind', 'guest_visit')
        .order('created_at', { ascending: false }),
      'created_at',
      since
    ).range(from, to)
  );

  const attendees = new Set();
  rows.forEach((r) => {
    if (r.attendee_id) attendees.add(r.attendee_id);
  });

  return {
    total: rows.length,
    uniqueAttendees: attendees.size,
  };
}

async function getAdminDemand(periodRaw) {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      provider: 'supabase',
      period: parsePeriod(periodRaw),
      error: 'not_configured',
    };
  }

  const period = parsePeriod(periodRaw);
  const since = sinceIso(period);
  const sb = getSupabaseAdmin();

  const [browseSearches, favourites, opportunities, guestVisits] = await Promise.all([
    aggregateBrowseSearches(sb, since).catch((e) => {
      if (/browse_search_events|relation|does not exist/i.test(String(e.message || ''))) {
        return {
          totalLogged: 0,
          withQuery: 0,
          zeroResults: 0,
          topQueries: [],
          zeroResultQueries: [],
          topLocations: [],
          topTypes: [],
          unavailable: true,
          message: 'Run migration 204_browse_search_analytics.sql to enable search logging.',
        };
      }
      throw e;
    }),
    aggregateFavourites(sb, since),
    aggregateOpportunities(sb, since),
    aggregateGuestVisits(sb, since),
  ]);

  return {
    configured: true,
    provider: 'supabase',
    period,
    updatedAt: new Date().toISOString(),
    browseSearches,
    favourites,
    opportunities,
    guestVisits,
  };
}

module.exports = { getAdminDemand, parsePeriod };
