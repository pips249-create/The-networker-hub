/**
 * Public organiser browse API — directory of published / verified organiser profiles.
 */
const { getSupabaseAdmin, isSupabaseConfigured, supabaseConfig } = require('./supabase');
const { publicOrganiserSlug } = require('./organiser-slug');
const { fetchPublishedEventRows, isPublicEvent, fetchAllPaged } = require('./supabase-events');
const { getGroupRankingsForOrganiser } = require('./organiser-group-ranking');
const { getOrganiserRankingHistory } = require('./organiser-ranking-snapshot');
const { reviewerDisplayName } = require('./reviewer-display-name');
const { isFeaturedUntilActive } = require('./admin-featured-until');

/** Slim columns for directory counts / regional location matching — never select *. */
const DIRECTORY_EVENT_SELECT =
  'id, organiser_id, title, slug, starts_at, city, postcode, outcode, location_label, venue, meeting_type, approval_status, status';
const MAX_LOCATIONS_PER_ORG = 16;
const ORG_PAGE_SIZE = 1000;

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
  if (raw.includes('person') || raw.includes('in-person') || raw.includes('in person')) return 'in-person';
  return raw.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Match public RLS: Verified or published listing, but never when admin/organiser-unpublished. */
function isPublicOrganiser(row) {
  if (!row || !row.id) return false;
  if (!String(row.name || '').trim()) return false;
  const status = String(row.listing_status || 'draft').toLowerCase();
  if (status === 'unpublished') return false;
  const verified = row.verification_status === 'Verified';
  const published = status === 'published';
  return verified || published;
}

/**
 * Apply the same visibility rules as organiser browse.
 * PostgREST-safe equivalent of isPublicOrganiser (excludes unpublished even if Verified).
 */
function applyPublicOrganiserBrowseFilter(query) {
  return query
    .not('name', 'is', null)
    .neq('name', '')
    .or(
      [
        'listing_status.eq.published',
        'and(verification_status.eq.Verified,listing_status.is.null)',
        'and(verification_status.eq.Verified,listing_status.eq.draft)',
        'and(verification_status.eq.Verified,listing_status.eq.published)',
      ].join(',')
    );
}

function isOrganiserClaimable(row) {
  if (!isPublicOrganiser(row)) return false;
  const status = String(row.ownership_claim_status || '').toLowerCase();
  return status !== 'claimed';
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
    featured: isFeaturedUntilActive(row),
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
    claimable: isOrganiserClaimable(row),
  };

  if (options.membershipPlan && options.membershipPlan.offered) {
    base.membershipPlan = {
      offered: true,
      vatTreatment: options.membershipPlan.vatTreatment || 'included',
      monthly: options.membershipPlan.monthly
        ? {
            amountPounds: options.membershipPlan.monthly.amountPounds,
            membershipVat: options.membershipPlan.monthly.membershipVat,
            membershipGross: options.membershipPlan.monthly.membershipGross,
            fee: options.membershipPlan.monthly.fee,
            feeVat: options.membershipPlan.monthly.feeVat,
            total: options.membershipPlan.monthly.total,
            interval: 'month',
            label: 'Monthly',
          }
        : null,
      annual: options.membershipPlan.annual
        ? {
            amountPounds: options.membershipPlan.annual.amountPounds,
            membershipVat: options.membershipPlan.annual.membershipVat,
            membershipGross: options.membershipPlan.annual.membershipGross,
            fee: options.membershipPlan.annual.fee,
            feeVat: options.membershipPlan.annual.feeVat,
            total: options.membershipPlan.annual.total,
            interval: 'year',
            label: 'Annually',
          }
        : null,
      feeLabel: options.membershipPlan.feeLabel,
      feeVatLabel: options.membershipPlan.feeVatLabel,
      feeExplanation: options.membershipPlan.feeExplanation,
    };
  }

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

  if (Array.isArray(options.rankingHistory) && options.rankingHistory.length) {
    base.rankingHistory = options.rankingHistory.map((row) => ({
      rank: row.rank,
      totalRanked: row.totalRanked,
      tier: row.tier,
      label: row.label,
      periodLabel: row.periodLabel || '',
      periodKey: row.periodKey || '',
      displayLabel: row.displayLabel || row.label,
      cardLabel: row.cardLabel || row.displayLabel || row.label,
    }));
  }

  return base;
}

async function fetchPublicOrganiserRows(sb) {
  const rows = await fetchAllPaged(
    sb,
    (from, to) =>
      sb.from('organisers').select('*').order('name').range(from, to),
    { pageSize: ORG_PAGE_SIZE }
  );
  return rows.filter(isPublicOrganiser);
}

async function loadPublishedEventIndex(sb, options = {}) {
  const organiserId = String(options.organiserId || '').trim() || null;
  const eventRows = await fetchPublishedEventRows(sb, {
    select: DIRECTORY_EVENT_SELECT,
    organiserId,
  });

  let orgById = new Map();
  if (organiserId) {
    const { data: org, error: orgErr } = await sb
      .from('organisers')
      .select('*')
      .eq('id', organiserId)
      .maybeSingle();
    if (orgErr) throw new Error(orgErr.message);
    if (org) orgById.set(org.id, org);
  } else {
    const orgIds = [...new Set((eventRows || []).map((e) => e.organiser_id).filter(Boolean))];
    for (let i = 0; i < orgIds.length; i += 80) {
      const chunk = orgIds.slice(i, i + 80);
      const { data: orgs, error: orgErr } = await sb.from('organisers').select('*').in('id', chunk);
      if (orgErr) throw new Error(orgErr.message);
      (orgs || []).forEach((o) => orgById.set(o.id, o));
    }
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

function locationsForOrganiser(organiserId, visibleEvents) {
  const seen = new Set();
  const locations = [];
  for (const event of visibleEvents || []) {
    if (event.organiser_id !== organiserId) continue;
    const city = String(event.city || '').trim();
    const postcode = String(event.postcode || '').trim();
    const outcode = String(event.outcode || '').trim();
    const location = String(event.location_label || '').trim();
    const venue = String(event.venue || '').trim();
    if (!city && !postcode && !outcode && !location && !venue) continue;
    const key = [outcode, city, postcode].join('|').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    locations.push({ city, postcode, outcode, location, venue });
    if (locations.length >= MAX_LOCATIONS_PER_ORG) break;
  }
  return locations;
}

async function fetchOrganiserReviews(sb, organiserId) {
  async function run(select) {
    const { data, error } = await sb
      .from('reviews')
      .select(select)
      .eq('organiser_id', organiserId)
      .order('created_at', { ascending: false })
      .limit(12);
    if (error) throw new Error(error.message);
    return data || [];
  }

  let data = [];
  try {
    data = await run(
      'id, rating, review_text, organiser_response, created_at, attendees(name, email, public_review_name)'
    );
  } catch (err) {
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('public_review_name')) {
      data = await run('id, rating, review_text, organiser_response, created_at, attendees(name, email)');
    } else {
      throw err;
    }
  }

  return data
    .map((row) => ({
      id: row.id,
      rating: Number(row.rating) || 0,
      text: String(row.review_text || '').trim(),
      reply: String(row.organiser_response || '').trim() || null,
      name: reviewerDisplayName(row.attendees),
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

  // Index locations by organiser once — avoid O(orgs × events) rescans.
  const locationsByOrg = new Map();
  (visibleEvents || []).forEach((event) => {
    if (!event.organiser_id) return;
    if (!locationsByOrg.has(event.organiser_id)) {
      locationsByOrg.set(event.organiser_id, []);
    }
    const list = locationsByOrg.get(event.organiser_id);
    if (list.length >= MAX_LOCATIONS_PER_ORG) return;
    const city = String(event.city || '').trim();
    const postcode = String(event.postcode || '').trim();
    const outcode = String(event.outcode || '').trim();
    const location = String(event.location_label || '').trim();
    const venue = String(event.venue || '').trim();
    if (!city && !postcode && !outcode && !location && !venue) return;
    const key = [outcode, city, postcode].join('|').toLowerCase();
    if (list._seen?.has(key)) return;
    if (!list._seen) list._seen = new Set();
    list._seen.add(key);
    list.push({ city, postcode, outcode, location, venue });
  });
  locationsByOrg.forEach((list) => {
    delete list._seen;
  });

  return organisers
    .map((org) => {
      return rowToPublicOrganiser(org, counts.get(org.id) || 0, {
        ranking: rankings[org.id] || null,
        locations: locationsByOrg.get(org.id) || [],
      });
    })
    .sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      if (b.rating !== a.rating) return b.rating - a.rating;
      return String(a.name).localeCompare(String(b.name));
    });
}

async function enrichPublicOrganiserDetail(sb, row) {
  const { visibleEvents, orgById } = await loadPublishedEventIndex(sb, { organiserId: row.id });
  const events = eventsForOrganiser(row.id, visibleEvents, orgById);
  const reviewItems = await fetchOrganiserReviews(sb, row.id);
  let rankings = {};
  try {
    rankings = await getGroupRankingsForOrganiser([row.id]);
  } catch {
    rankings = {};
  }
  let rankingHistory = [];
  try {
    rankingHistory = await getOrganiserRankingHistory(row.id, { limit: 18 });
  } catch {
    rankingHistory = [];
  }

  let membershipPlan = null;
  try {
    const { getMembershipPlanForOrganiser } = require('./membership-billing');
    membershipPlan = await getMembershipPlanForOrganiser(row.id);
    if (membershipPlan && !membershipPlan.offered) membershipPlan = null;
  } catch {
    membershipPlan = null;
  }

  return rowToPublicOrganiser(row, events.length, {
    includeEvents: true,
    events,
    includeReviews: true,
    reviewItems,
    ranking: rankings[row.id] || null,
    rankingHistory,
    membershipPlan,
    locations: locationsForOrganiser(row.id, visibleEvents),
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
    // Fallback for legacy title-derived slugs — paginated, not a single unbounded select.
    const rows = await fetchPublicOrganiserRows(sb);
    row =
      rows.find((candidate) => {
        const pub = publicOrganiserSlug(candidate);
        return pub && String(pub).toLowerCase() === slugLower;
      }) || null;
  }

  if (!row || !isPublicOrganiser(row)) return null;
  return enrichPublicOrganiserDetail(sb, row);
}

async function getPublicOrganiserById(id) {
  const recordId = String(id || '').trim();
  if (!recordId) return null;
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabaseAdmin();

  const { data: row, error } = await sb.from('organisers').select('*').eq('id', recordId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row || !isPublicOrganiser(row)) return null;

  return enrichPublicOrganiserDetail(sb, row);
}

module.exports = {
  listPublicOrganisers,
  getPublicOrganiserBySlug,
  getPublicOrganiserById,
  rowToPublicOrganiser,
  fetchOrganiserReviews,
  resolvePhotoUrl,
  isPublicOrganiser,
  isOrganiserClaimable,
  applyPublicOrganiserBrowseFilter,
};
