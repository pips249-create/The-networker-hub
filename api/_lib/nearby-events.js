const { isEventPublishedForSale } = require('./ticket-sales');
const { parseOutcode, haversineMiles, bboxForRadiusMiles, cityRegionFromInput } = require('./uk-outcode');
const { geocodeUkLocation } = require('./postcode-geocode');

/** Max distance for "events near you" blocks in lifecycle and newsletter emails. */
const NEARBY_EMAIL_RADIUS_MILES = 25;

const EVENT_SELECT_FIELDS =
  'id, title, slug, starts_at, city, venue, location_label, postcode, outcode, latitude, longitude, status, approval_status, published_at, featured, ticket_sales_enabled, refund_terms_agreed_at, refund_terms_agreed, organisers(name)';

function locationTokens(location) {
  const raw = String(location || '').trim().toLowerCase();
  if (!raw) return [];
  return raw
    .split(/[,/]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);
}

function eventMatchesLocation(eventRow, tokens) {
  if (!tokens.length) return false;
  const haystack = [
    eventRow.city,
    eventRow.venue,
    eventRow.location_label,
    eventRow.postcode,
    eventRow.outcode,
  ]
    .map((v) => String(v || '').toLowerCase())
    .join(' ');
  return tokens.some((token) => haystack.includes(token));
}

function nearbyLocationLabel(location) {
  const raw = String(location || '').trim();
  if (!raw) return '';
  return raw.split(',')[0].trim();
}

function eventWithinRadiusMiles(eventRow, lat, lng, radiusMi) {
  const eventLat = Number(eventRow.latitude);
  const eventLng = Number(eventRow.longitude);
  if (!Number.isFinite(eventLat) || !Number.isFinite(eventLng)) return false;
  return haversineMiles(lat, lng, eventLat, eventLng) <= radiusMi;
}

async function fetchNearbyEventsByRadius(sb, lat, lng, options = {}) {
  const excludeIds = new Set((options.excludeEventIds || []).map((id) => String(id || '').trim()).filter(Boolean));
  const limit = Math.max(1, Math.min(Number(options.limit) || 4, 8));
  const radiusMi = Math.min(
    Math.max(Number(options.radiusMiles) || NEARBY_EMAIL_RADIUS_MILES, 1),
    NEARBY_EMAIL_RADIUS_MILES
  );
  const now = new Date().toISOString();
  const box = bboxForRadiusMiles(lat, lng, radiusMi);

  const { data, error } = await sb
    .from('events')
    .select(EVENT_SELECT_FIELDS)
    .eq('status', 'published')
    .eq('approval_status', 'Approved')
    .gt('starts_at', now)
    .gte('latitude', box.minLat)
    .lte('latitude', box.maxLat)
    .gte('longitude', box.minLng)
    .lte('longitude', box.maxLng)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .order('starts_at', { ascending: true })
    .limit(120);
  if (error) throw new Error(error.message);

  return (data || [])
    .filter(isEventPublishedForSale)
    .filter((row) => eventWithinRadiusMiles(row, lat, lng, radiusMi))
    .filter((row) => !excludeIds.has(String(row.id)))
    .slice(0, limit);
}

async function fetchNearbyEventsByText(sb, location, options = {}) {
  const tokens = locationTokens(location);
  if (!tokens.length) return [];

  const excludeIds = new Set((options.excludeEventIds || []).map((id) => String(id || '').trim()).filter(Boolean));
  const limit = Math.max(1, Math.min(Number(options.limit) || 4, 8));
  const now = new Date().toISOString();

  const { data, error } = await sb
    .from('events')
    .select(EVENT_SELECT_FIELDS)
    .eq('status', 'published')
    .eq('approval_status', 'Approved')
    .gt('starts_at', now)
    .order('starts_at', { ascending: true })
    .limit(60);
  if (error) throw new Error(error.message);

  return (data || [])
    .filter(isEventPublishedForSale)
    .filter((row) => eventMatchesLocation(row, tokens))
    .filter((row) => !excludeIds.has(String(row.id)))
    .slice(0, limit);
}

/**
 * Upcoming published events near the member location (25-mile radius when geocodable).
 */
async function fetchNearbyEvents(sb, location, options = {}) {
  const raw = String(location || '').trim();
  if (!raw) return { events: [], locationLabel: '' };

  const radiusMi = Math.min(
    Math.max(Number(options.radiusMiles) || NEARBY_EMAIL_RADIUS_MILES, 1),
    NEARBY_EMAIL_RADIUS_MILES
  );
  const coords = await geocodeUkLocation(raw);
  if (coords?.latitude != null && coords?.longitude != null) {
    const events = await fetchNearbyEventsByRadius(sb, coords.latitude, coords.longitude, {
      ...options,
      radiusMiles: radiusMi,
    });
    return {
      events,
      locationLabel: nearbyLocationLabel(raw) || String(coords.city || '').trim(),
      radiusMiles: radiusMi,
    };
  }

  const events = await fetchNearbyEventsByText(sb, raw, options);
  return {
    events,
    locationLabel: nearbyLocationLabel(raw),
    radiusMiles: null,
  };
}

/**
 * Upcoming events ranked by recent booking volume (last 30 days), with featured/rating fallback.
 */
async function fetchPopularEvents(sb, options = {}) {
  const limit = Math.max(1, Math.min(Number(options.limit) || 3, 6));
  const excludeIds = new Set(
    (options.excludeEventIds || []).map((id) => String(id || '').trim()).filter(Boolean)
  );
  const since =
    options.since ||
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  const selectFields =
    'id, title, slug, starts_at, city, venue, location_label, postcode, outcode, status, approval_status, published_at, featured, average_rating, ticket_sales_enabled, refund_terms_agreed_at, refund_terms_agreed, organisers(name)';

  const { data: regs, error: regErr } = await sb
    .from('registrations')
    .select('event_id')
    .in('payment_status', ['Paid', 'Free'])
    .neq('application_status', 'Denied')
    .is('cancelled_at', null)
    .gte('created_at', since)
    .not('event_id', 'is', null);
  if (regErr) throw new Error(regErr.message);

  const counts = new Map();
  (regs || []).forEach((row) => {
    const id = String(row.event_id || '').trim();
    if (!id) return;
    counts.set(id, (counts.get(id) || 0) + 1);
  });

  const rankedIds = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
    .filter((id) => !excludeIds.has(id));

  async function fetchFeaturedFallback(needed) {
    const { data, error } = await sb
      .from('events')
      .select(selectFields)
      .eq('status', 'published')
      .eq('approval_status', 'Approved')
      .gt('starts_at', now)
      .order('featured', { ascending: false })
      .order('average_rating', { ascending: false, nullsFirst: true })
      .order('starts_at', { ascending: true })
      .limit(Math.max(needed * 3, 12));
    if (error) throw new Error(error.message);
    return (data || [])
      .filter(isEventPublishedForSale)
      .filter((row) => !excludeIds.has(String(row.id)));
  }

  if (!rankedIds.length) {
    const fallback = await fetchFeaturedFallback(limit);
    return { events: fallback.slice(0, limit), source: 'featured' };
  }

  const { data: events, error: evErr } = await sb
    .from('events')
    .select(selectFields)
    .in('id', rankedIds.slice(0, limit * 4))
    .eq('status', 'published')
    .eq('approval_status', 'Approved')
    .gt('starts_at', now);
  if (evErr) throw new Error(evErr.message);

  const byId = new Map(
    (events || []).filter(isEventPublishedForSale).map((row) => [String(row.id), row])
  );
  const picked = rankedIds.map((id) => byId.get(id)).filter(Boolean);

  if (picked.length < limit) {
    const seen = new Set(picked.map((row) => String(row.id)));
    const fallback = await fetchFeaturedFallback(limit - picked.length);
    for (const row of fallback) {
      const id = String(row.id);
      if (seen.has(id) || excludeIds.has(id)) continue;
      picked.push(row);
      seen.add(id);
      if (picked.length >= limit) break;
    }
  }

  return { events: picked.slice(0, limit), source: 'bookings' };
}

module.exports = {
  NEARBY_EMAIL_RADIUS_MILES,
  locationTokens,
  eventMatchesLocation,
  nearbyLocationLabel,
  fetchNearbyEvents,
  fetchPopularEvents,
};
