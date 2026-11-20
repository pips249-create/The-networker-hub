/**
 * Public read-only events feed for AI assistants / answer engines.
 * Maps the live browse catalogue into a stable, attribution-friendly shape.
 */
const { fetchBrowseEventsPage } = require('./browse-events-query');
const { siteOrigin } = require('./hubert-seo');

const FEED_MAX_LIMIT = 48;
const FEED_DEFAULT_LIMIT = 24;

function absoluteOrigin(origin) {
  return siteOrigin(origin || process.env.SITE_URL);
}

function eventPageUrl(origin, slug) {
  const s = String(slug || '').trim();
  if (!s) return '';
  return absoluteOrigin(origin) + '/events/' + encodeURIComponent(s);
}

function organiserPageUrl(origin, slug) {
  const s = String(slug || '').trim();
  if (!s) return '';
  return absoluteOrigin(origin) + '/organisers/' + encodeURIComponent(s);
}

function hasGuestVisit(ev) {
  if (!ev || typeof ev !== 'object') return false;
  if (ev.guestVisitTier) return true;
  if (Number(ev.complimentaryVisitsAllowed) > 0) return true;
  if (ev.guestPassesDisabled === true) return false;
  return false;
}

function bookingUrl(origin, ev) {
  const external = String((ev && ev.externalBookingUrl) || '').trim();
  if (external && /^https?:\/\//i.test(external)) return external;
  return eventPageUrl(origin, ev && ev.slug);
}

function mapPublicEvent(ev, origin) {
  const base = absoluteOrigin(origin);
  const slug = String((ev && ev.slug) || '').trim();
  const startsAt = String((ev && (ev.dateRaw || ev.nextDate || ev.dateFieldRaw)) || '').trim();
  const endsAt = String((ev && ev.endDateRaw) || '').trim();
  const guestVisit = hasGuestVisit(ev);
  const status =
    ev && ev.isEventPast
      ? 'past'
      : ev && ev.isSoldOut
        ? 'sold_out'
        : 'published';

  return {
    name: String((ev && ev.title) || '').trim(),
    slug,
    url: eventPageUrl(base, slug),
    organiser: String((ev && ev.organiser) || '').trim(),
    organiserSlug: String((ev && ev.organiserSlug) || '').trim(),
    organiserUrl: organiserPageUrl(base, ev && ev.organiserSlug),
    city: String((ev && (ev.city || ev.locationShort)) || '').trim(),
    venue: String((ev && (ev.venueName || ev.venue)) || '').trim(),
    venueAddress: String((ev && (ev.venueAddress || ev.location)) || '').trim(),
    date: String((ev && ev.date) || '').trim(),
    startsAt: startsAt || null,
    endsAt: endsAt || null,
    time: String((ev && ev.time) || '').trim(),
    price: String((ev && ev.price) || '').trim(),
    priceKey: String((ev && ev.priceKey) || '').trim() || null,
    free: Boolean(ev && (ev.hasFreeTickets || ev.priceKey === 'free')),
    guestVisit,
    category: String((ev && (ev.eventType || ev.typeRaw || ev.type)) || '').trim(),
    format: String((ev && (ev.format || ev.meetingType)) || '').trim(),
    bookingUrl: bookingUrl(base, ev),
    status,
    lastUpdated: String((ev && ev.createdAt) || '').trim() || null,
  };
}

function buildPublicEventsQuery(rawQuery) {
  const q = rawQuery && typeof rawQuery === 'object' ? { ...rawQuery } : {};
  const limit = Math.min(
    Math.max(parseInt(String(q.limit || ''), 10) || FEED_DEFAULT_LIMIT, 1),
    FEED_MAX_LIMIT
  );
  const page = Math.max(parseInt(String(q.page || ''), 10) || 1, 1);

  // Prefer date order for assistant queries ("this week", "next month").
  if (!q.sort) q.sort = 'date';
  q.limit = String(limit);
  q.page = String(page);
  // Avoid heavy browse meta (type counts / spotlight) for feed consumers.
  q.meta = '0';
  delete q.mode;
  delete q.probe;
  delete q.all;

  return q;
}

async function fetchPublicEventsFeed(sb, rawQuery, origin) {
  const query = buildPublicEventsQuery(rawQuery);
  const payload = await fetchBrowseEventsPage(sb, query);
  const events = Array.isArray(payload.events) ? payload.events : [];
  const mapped = events.map((ev) => mapPublicEvent(ev, origin));
  const pagination = payload.pagination || {};

  return {
    ok: true,
    source: 'The Networker UK',
    attribution: {
      name: 'The Networker UK',
      url: absoluteOrigin(origin) + '/',
      license: 'Public listings may be cited with a link back to the event or organiser page.',
    },
    generatedAt: new Date().toISOString(),
    filters: {
      location: String(query.location || '').trim() || null,
      q: String(query.q || '').trim() || null,
      type: String(query.type || query.types || '').trim() || null,
      freeOnly: String(query.free || query.freeOnly || '') === '1' ? true : null,
      dateFrom: String(query.dateFrom || query.from || '').trim() || null,
      dateTo: String(query.dateTo || query.to || '').trim() || null,
      sort: String(query.sort || 'date'),
    },
    events: mapped,
    pagination: {
      page: pagination.page || 1,
      limit: pagination.limit || FEED_DEFAULT_LIMIT,
      total: pagination.listingTotal != null ? pagination.listingTotal : pagination.total || mapped.length,
      totalPages: pagination.totalPages || 1,
    },
    docs: {
      endpoint: absoluteOrigin(origin) + '/api/public/events',
      examples: [
        absoluteOrigin(origin) + '/api/public/events?location=Manchester&limit=10',
        absoluteOrigin(origin) + '/api/public/events?location=Leeds&free=1',
        absoluteOrigin(origin) + '/api/public/events?q=women&location=London',
      ],
    },
  };
}

module.exports = {
  FEED_MAX_LIMIT,
  FEED_DEFAULT_LIMIT,
  mapPublicEvent,
  buildPublicEventsQuery,
  fetchPublicEventsFeed,
  eventPageUrl,
  organiserPageUrl,
  hasGuestVisit,
};
