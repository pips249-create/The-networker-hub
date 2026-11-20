/**
 * Public read-only organiser feed for AI assistants / answer engines.
 */
const { listPublicOrganisers } = require('./supabase-organisers-browse');
const { siteOrigin } = require('./hubert-seo');

const FEED_MAX_LIMIT = 48;
const FEED_DEFAULT_LIMIT = 24;

function absoluteOrigin(origin) {
  return siteOrigin(origin || process.env.SITE_URL);
}

function organiserPageUrl(origin, slug) {
  const s = String(slug || '').trim();
  if (!s) return '';
  return absoluteOrigin(origin) + '/organisers/' + encodeURIComponent(s);
}

function primaryCity(org) {
  const locations = Array.isArray(org && org.locations) ? org.locations : [];
  if (locations.length && locations[0]) {
    return String(locations[0].city || locations[0].outcode || '').trim();
  }
  return String((org && (org.city || org.location)) || '').trim();
}

function mapPublicOrganiser(org, origin) {
  const slug = String((org && org.slug) || '').trim();
  const guestLimit = Number(org && org.guestVisitsAllowed);
  return {
    name: String((org && org.name) || '').trim(),
    slug,
    url: organiserPageUrl(origin, slug),
    city: primaryCity(org),
    description: String((org && org.description) || '')
      .trim()
      .slice(0, 400),
    rating: org && Number.isFinite(Number(org.rating)) ? Number(org.rating) : null,
    reviews: org && org.reviews != null ? Number(org.reviews) : 0,
    guestVisits: Number.isFinite(guestLimit) && guestLimit > 0,
    upcomingEvents: org && org.eventCount != null ? Number(org.eventCount) : 0,
  };
}

function matchesLocation(org, location) {
  const needle = String(location || '')
    .trim()
    .toLowerCase();
  if (!needle) return true;
  const hay = [
    primaryCity(org),
    ...(Array.isArray(org.locations)
      ? org.locations.map((loc) => [loc.city, loc.postcode, loc.outcode].filter(Boolean).join(' '))
      : []),
  ]
    .join(' ')
    .toLowerCase();
  return hay.indexOf(needle) !== -1;
}

function matchesSearch(org, search) {
  const needle = String(search || '')
    .trim()
    .toLowerCase();
  if (!needle) return true;
  const hay = [org.name, org.description, primaryCity(org), org.industry]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.indexOf(needle) !== -1;
}

async function fetchPublicOrganisersFeed(rawQuery, origin) {
  const q = rawQuery && typeof rawQuery === 'object' ? rawQuery : {};
  const limit = Math.min(
    Math.max(parseInt(String(q.limit || ''), 10) || FEED_DEFAULT_LIMIT, 1),
    FEED_MAX_LIMIT
  );
  const page = Math.max(parseInt(String(q.page || ''), 10) || 1, 1);
  const location = String(q.location || q.city || '').trim();
  const search = String(q.q || q.search || '').trim();
  const guestOnly = String(q.guestVisits || q.guest || '') === '1';

  const all = await listPublicOrganisers();
  const rows = Array.isArray(all) ? all : [];
  let filtered = rows.filter((org) => matchesLocation(org, location) && matchesSearch(org, search));
  if (guestOnly) {
    filtered = filtered.filter((org) => Number(org.guestVisitsAllowed) > 0);
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const offset = (page - 1) * limit;
  const pageRows = filtered.slice(offset, offset + limit);
  const mapped = pageRows.map((org) => mapPublicOrganiser(org, origin));

  return {
    ok: true,
    source: 'The Networker UK',
    attribution: {
      name: 'The Networker UK',
      url: absoluteOrigin(origin) + '/',
      license: 'Public organiser profiles may be cited with a link back to the organiser page.',
    },
    generatedAt: new Date().toISOString(),
    filters: {
      location: location || null,
      q: search || null,
      guestVisits: guestOnly || null,
    },
    organisers: mapped,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
    docs: {
      endpoint: absoluteOrigin(origin) + '/api/public/organisers',
      examples: [
        absoluteOrigin(origin) + '/api/public/organisers?location=Manchester&limit=10',
        absoluteOrigin(origin) + '/api/public/organisers?guestVisits=1',
        absoluteOrigin(origin) + '/api/public/organisers?q=BNI',
      ],
    },
  };
}

module.exports = {
  mapPublicOrganiser,
  fetchPublicOrganisersFeed,
  organiserPageUrl,
};
