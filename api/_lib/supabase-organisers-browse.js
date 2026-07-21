/**
 * Public organiser browse API — directory of published / verified organiser profiles.
 */
const { getSupabaseAdmin, isSupabaseConfigured, supabaseConfig } = require('./supabase');
const { publicOrganiserSlug } = require('./organiser-slug');
const { fetchPublishedEventRows, isPublicEvent } = require('./supabase-events');
const { getGroupRankingsForOrganiser } = require('./organiser-group-ranking');

function slugIndustry(ind) {
  return String(ind || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function slugFormat(fmt) {
  const raw = String(fmt || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw.includes('online') && !raw.includes('person')) return 'online';
  if (raw.includes('hybrid')) return 'hybrid';
  if (raw.includes('person') || raw.includes('in-person') || raw.includes('in person')) return 'in-person';
  return raw.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Match public RLS: Verified OR listing_status published — exclude draft shells. */
function isPublicOrganiser(row) {
  if (!row || !row.id) return false;
  if (!String(row.name || '').trim()) return false;
  const verified = row.verification_status === 'Verified';
  const published = String(row.listing_status || '').toLowerCase() === 'published';
  return verified || published;
}

function resolvePhotoUrl(raw) {
  const url = String(raw || '').trim();
  if (!url) return '';

  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      const path = parsed.pathname.toLowerCase();
      // Profile / share pages mistaken for logo files — browsers CORB-block the HTML response.
      if (
        /(^|\.)(linkedin|facebook|instagram|twitter|x)\.com$/i.test(host) &&
        !/\.(jpe?g|png|gif|webp|svg)(\?|$)/i.test(path)
      ) {
        return '';
      }
      if (/(^|\.)(drive|docs)\.google\.com$/i.test(host)) {
        return '';
      }
    } catch {
      return '';
    }
    return url;
  }

  if (url.startsWith('/')) return url;

  const { url: base } = supabaseConfig();
  if (!base) return url;
  const clean = url.replace(/^\/+/, '');
  if (clean.startsWith('storage/v1/')) return `${base.replace(/\/$/, '')}/${clean}`;
  return `${base.replace(/\/$/, '')}/storage/v1/object/public/organiser-assets/${clean}`;
}

function rowToPublicOrganiser(row, eventCount, options) {
  options = options || {};
  const industries = Array.isArray(row.industries) ? row.industries.filter(Boolean) : [];
  const meetingFormats = Array.isArray(row.meeting_formats)
    ? row.meeting_formats.filter(Boolean)
    : [];
  const industry = industries[0] || '';
  const rating = row.average_rating != null ? Number(row.average_rating) : 0;
  const reviews = Number(row.review_count) || 0;
  const name = String(row.name || 'Untitled organiser').trim();
  const description = String(row.description || '').trim();
  const slug = publicOrganiserSlug(row) || '';
  const locations = Array.isArray(options.locations) ? options.locations : [];

  const base = {
    id: row.id,
    slug,
    name,
    description,
    photoUrl: resolvePhotoUrl(row.photo_url),
    industries,
    industry,
    industrySlug: slugIndustry(industry),
    meetingFormats,
    formatSlugs: meetingFormats.map(slugFormat).filter(Boolean),
    rating: Number.isFinite(rating) ? rating : 0,
    reviews,
    eventCount: Number(eventCount) || 0,
    locations,
    guestVisitsAllowed: Math.min(3, Math.max(0, Number(row.complimentary_visits_allowed) || 0)),
    featured: Boolean(row.featured),
    website: String(row.website || '').trim(),
    instagramUrl: String(row.instagram_url || '').trim(),
    facebookUrl: String(row.facebook_url || '').trim(),
    linkedinUrl: String(row.linkedin_url || '').trim(),
    xUrl: String(row.x_url || '').trim(),
    search: [
      name,
      description,
      industry,
      industries.join(' '),
      meetingFormats.join(' '),
      locations.map((location) => [location.city, location.postcode, location.outcode].filter(Boolean).join(' ')).join(' '),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  };

  if (options.includeEvents && Array.isArray(options.events)) {
    base.events = options.events;
  }

  if (options.includeReviews && Array.isArray(options.reviewItems)) {
    base.reviewItems = options.reviewItems;
  }

  if (options.ranking && options.ranking.label) {
    base.ranking = {
      rank: options.ranking.rank,
      totalRanked: options.ranking.totalRanked,
      tier: options.ranking.tier,
      label: options.ranking.label,
      periodLabel: options.ranking.periodLabel || '',
      displayLabel: options.ranking.displayLabel || options.ranking.label,
      cardLabel: options.ranking.cardLabel || options.ranking.displayLabel,
    };
  }

  return base;
}

async function fetchPublicOrganiserRows(sb) {
  const { data, error } = await sb.from('organisers').select('*').order('name');
  if (error) throw new Error(error.message);
  return (data || []).filter(isPublicOrganiser);
}
async function loadPublishedEventIndex(sb) {
  const eventRows = await fetchPublishedEventRows(sb);
  const orgIds = [...new Set((eventRows || []).map((e) => e.organiser_id).filter(Boolean))];

  let orgById = new Map();
  if (orgIds.length) {
    const { data: orgs, error: orgErr } = await sb.from('organisers').select('*').in('id', orgIds);
    if (orgErr) throw new Error(orgErr.message);
    orgById = new Map((orgs || []).map((o) => [o.id, o]));
  }

  const visibleEvents = (eventRows || []).filter((row) => {
    const org = row.organiser_id ? orgById.get(row.organiser_id) : null;
    return isPublicEvent(row, org) && isPublicOrganiser(org);
  });

  const counts = new Map();
  visibleEvents.forEach((row) => {
    if (!row.organiser_id) return;
    counts.set(row.organiser_id, (counts.get(row.organiser_id) || 0) + 1);
  });

  return { visibleEvents, counts, orgById };
}

function summariseEvent(row, organiser) {
  const startsAt = row.starts_at || row.next_date || null;
  const d = startsAt ? new Date(startsAt) : null;
  const dateLine =
    d && !Number.isNaN(d.getTime())
      ? d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
      : 'Date TBC';
  return {
    id: row.id,
    slug: row.slug || '',
    title: row.title || 'Event',
    startsAt,
    dateLine,
    city: row.city || '',
    meetingType: row.meeting_type || '',
    organiserId: row.organiser_id || organiser?.id || null,
  };
}

function eventsForOrganiser(organiserId, visibleEvents, orgById) {
  return (visibleEvents || [])
    .filter((ev) => ev.organiser_id === organiserId)
    .map((ev) => summariseEvent(ev, orgById.get(organiserId)))
    .sort((a, b) => {
      const ta = a.startsAt ? new Date(a.startsAt).getTime() : Infinity;
      const tb = b.startsAt ? new Date(b.startsAt).getTime() : Infinity;
      return ta - tb;
    });
}

async function fetchOrganiserReviews(sb, organiserId) {
  const { data, error } = await sb
    .from('reviews')
    .select('id, rating, review_text, organiser_response, created_at, attendees(name, email)')
    .eq('organiser_id', organiserId)
    .order('created_at', { ascending: false })
    .limit(12);
  if (error) throw new Error(error.message);

  return (data || [])
    .map((row) => ({
      id: row.id,
      rating: Number(row.rating) || 0,
      text: String(row.review_text || '').trim(),
      reply: String(row.organiser_response || '').trim() || null,
      name: row.attendees?.name || row.attendees?.email || 'Attendee',
      date: row.created_at
        ? new Date(row.created_at).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : '',
    }))
    .filter((item) => item.rating > 0);
}

async function listPublicOrganisers() {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabaseAdmin();
  const [organisers, { counts, visibleEvents }] = await Promise.all([
    fetchPublicOrganiserRows(sb),
    loadPublishedEventIndex(sb),
  ]);

  let rankings = {};
  try {
    rankings = await getGroupRankingsForOrganiser(organisers.map((org) => org.id));
  } catch {
    rankings = {};
  }

  return organisers
    .map((org) => {
      const locations = (visibleEvents || [])
        .filter((event) => event.organiser_id === org.id)
        .map((event) => ({
          city: String(event.city || '').trim(),
          postcode: String(event.postcode || '').trim(),
          outcode: String(event.outcode || '').trim(),
          location: String(event.location_label || '').trim(),
          venue: String(event.venue || '').trim(),
        }));
      return rowToPublicOrganiser(org, counts.get(org.id) || 0, {
        ranking: rankings[org.id] || null,
        locations,
      });
    })
    .sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      if (b.rating !== a.rating) return b.rating - a.rating;
      return String(a.name).localeCompare(String(b.name));
    });
}

async function getPublicOrganiserBySlug(slug) {
  const s = String(slug || '').trim();
  if (!s) return null;
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabaseAdmin();
  const slugLower = s.toLowerCase();

  let row = null;
  const { data: byStored, error } = await sb.from('organisers').select('*').eq('slug', s).maybeSingle();
  if (error) throw new Error(error.message);
  if (byStored && isPublicOrganiser(byStored)) row = byStored;

  if (!row) {
    const rows = await fetchPublicOrganiserRows(sb);
    row =
      rows.find((candidate) => {
        const pub = publicOrganiserSlug(candidate);
        return pub && String(pub).toLowerCase() === slugLower;
      }) || null;
  }

  if (!row || !isPublicOrganiser(row)) return null;

  const { visibleEvents, orgById } = await loadPublishedEventIndex(sb);
  const events = eventsForOrganiser(row.id, visibleEvents, orgById);
  const reviewItems = await fetchOrganiserReviews(sb, row.id);
  let rankings = {};
  try {
    rankings = await getGroupRankingsForOrganiser([row.id]);
  } catch {
    rankings = {};
  }

  return rowToPublicOrganiser(row, events.length, {
    includeEvents: true,
    events,
    includeReviews: true,
    reviewItems,
    ranking: rankings[row.id] || null,
  });
}

async function getPublicOrganiserById(id) {
  const recordId = String(id || '').trim();
  if (!recordId) return null;
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabaseAdmin();

  const { data: row, error } = await sb.from('organisers').select('*').eq('id', recordId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row || !isPublicOrganiser(row)) return null;

  const { visibleEvents, orgById } = await loadPublishedEventIndex(sb);
  const events = eventsForOrganiser(row.id, visibleEvents, orgById);
  const reviewItems = await fetchOrganiserReviews(sb, row.id);
  let rankings = {};
  try {
    rankings = await getGroupRankingsForOrganiser([row.id]);
  } catch {
    rankings = {};
  }

  return rowToPublicOrganiser(row, events.length, {
    includeEvents: true,
    events,
    includeReviews: true,
    reviewItems,
    ranking: rankings[row.id] || null,
  });
}

module.exports = {
  listPublicOrganisers,
  getPublicOrganiserBySlug,
  getPublicOrganiserById,
  rowToPublicOrganiser,
  fetchOrganiserReviews,
  resolvePhotoUrl,
};
