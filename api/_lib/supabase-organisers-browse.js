/**
 * Public organiser browse API — directory of all organiser profiles (any listing status).
 */
const { getSupabaseAdmin, isSupabaseConfigured, supabaseConfig } = require('./supabase');
const { publicOrganiserSlug } = require('./organiser-slug');
const { fetchPublishedEventRows, isPublicEvent } = require('./supabase-events');

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

function isPublicOrganiser(row) {
  if (!row || !row.id) return false;
  return Boolean(String(row.name || '').trim());
}

function resolvePhotoUrl(raw) {
  const url = String(raw || '').trim();
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
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
    featured: Boolean(row.featured),
    website: String(row.website || '').trim(),
    search: [name, description, industry, industries.join(' '), meetingFormats.join(' ')]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  };

  if (options.includeEvents && Array.isArray(options.events)) {
    base.events = options.events;
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

async function listPublicOrganisers() {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabaseAdmin();
  const [organisers, { counts }] = await Promise.all([
    fetchPublicOrganiserRows(sb),
    loadPublishedEventIndex(sb),
  ]);

  return organisers
    .map((org) => rowToPublicOrganiser(org, counts.get(org.id) || 0))
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

  const { data: row, error } = await sb.from('organisers').select('*').eq('slug', s).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row || !isPublicOrganiser(row)) return null;

  const { visibleEvents, orgById } = await loadPublishedEventIndex(sb);
  const events = eventsForOrganiser(row.id, visibleEvents, orgById);

  return rowToPublicOrganiser(row, events.length, { includeEvents: true, events });
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

  return rowToPublicOrganiser(row, events.length, { includeEvents: true, events });
}

module.exports = {
  listPublicOrganisers,
  getPublicOrganiserBySlug,
  getPublicOrganiserById,
  rowToPublicOrganiser,
};
