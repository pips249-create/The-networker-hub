/**
 * XML sitemap for public indexable URLs.
 */
const { siteOrigin } = require('./hubert-seo');
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { fetchPublishedEventRows, isPublicEvent } = require('./supabase-events');
const { publicEventSlug } = require('./event-slug');
const { publicOrganiserSlug } = require('./organiser-slug');
const { publicOpportunitySlug } = require('./opportunity-slug');
const { NETWORKING_REGION_SLUGS } = require('./networking-regions');
const { OPPORTUNITY_INDUSTRY_SLUGS } = require('./opportunity-industries');

const STATIC_PATHS = [
  '/',
  '/events/',
  '/opportunities/',
  '/guides',
  '/guides/list-an-event',
  '/guides/list-a-conference-or-exhibition',
  '/guides/list-a-business-opportunity',
  '/guides/invite-your-team',
  '/guides/claim-your-organiser-page',
  '/guides/export-attendees-and-visits',
  '/faq',
  '/help/organiser-payouts',
  '/help/pricing-fees',
  '/contact',
  '/about',
  '/rankings',
  '/for-organisers',
  '/add-your-event',
  '/for-networkers',
  '/advertising',
  '/partners',
  '/legal-policies',
  ...NETWORKING_REGION_SLUGS.map((slug) => '/networking/' + slug),
  ...OPPORTUNITY_INDUSTRY_SLUGS.map((slug) => '/opportunities/industry/' + slug),
];

const SITEMAP_CACHE_TTL_MS = 10 * 60 * 1000;
const sitemapCache = new Map();

function xmlEscape(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function urlEntry(origin, path, lastmod) {
  const loc = origin + (path.startsWith('/') ? path : '/' + path);
  let xml = '  <url>\n    <loc>' + xmlEscape(loc) + '</loc>\n';
  if (lastmod) {
    xml += '    <lastmod>' + xmlEscape(lastmod) + '</lastmod>\n';
  }
  xml += '  </url>\n';
  return xml;
}

function isoDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

async function fetchOrganisersByIds(sb, orgIds) {
  const orgById = new Map();
  for (let i = 0; i < orgIds.length; i += 80) {
    const chunk = orgIds.slice(i, i + 80);
    const { data: orgs, error: orgErr } = await sb
      .from('organisers')
      .select('id, name, slug, listing_status, verification_status, created_at')
      .in('id', chunk);
    if (orgErr) throw new Error(orgErr.message);
    (orgs || []).forEach((o) => orgById.set(o.id, o));
  }
  return orgById;
}

async function buildSitemapXmlUncached(originOverride) {
  const origin = siteOrigin(originOverride);
  const today = new Date().toISOString().slice(0, 10);
  let body = STATIC_PATHS.map((path) => urlEntry(origin, path, today)).join('');

  if (!isSupabaseConfigured()) {
    return (
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      body +
      '</urlset>\n'
    );
  }

  const sb = getSupabaseAdmin();
  const [eventRows, opportunityRows] = await Promise.all([
    fetchPublishedEventRows(sb, {
      // events has created_at only (no updated_at column)
      select: 'id, slug, title, organiser_id, starts_at, created_at, approval_status, status',
    }),
    sb
      .from('business_opportunities')
      .select('id, title, slug, updated_at, published_at, created_at, status, approval_status, listing_expires_at')
      .eq('status', 'published')
      .eq('approval_status', 'Approved')
      .order('published_at', { ascending: false, nullsFirst: false }),
  ]);
  if (opportunityRows.error) throw new Error(opportunityRows.error.message);

  const orgIds = [...new Set((eventRows || []).map((row) => row.organiser_id).filter(Boolean))];
  // Only load organisers that own published events — avoids a full organisers table scan
  // that used to stack on top of the event catalogue read and time out /api/seo.
  const orgById = await fetchOrganisersByIds(sb, orgIds);

  const events = (eventRows || []).filter((row) => {
    const org = row.organiser_id ? orgById.get(row.organiser_id) : null;
    return isPublicEvent(row, org);
  });

  // One <loc> per public event slug (recurring series share a slug — duplicates upset GSC).
  const eventSlugLastmod = new Map();
  (events || []).forEach((row) => {
    const slug = publicEventSlug({ slug: row.slug, title: row.title });
    if (!slug) return;
    const lastmod = isoDate(row.starts_at || row.created_at);
    const prev = eventSlugLastmod.get(slug);
    if (prev == null || (lastmod && lastmod > prev)) {
      eventSlugLastmod.set(slug, lastmod || prev || '');
    }
  });
  eventSlugLastmod.forEach((lastmod, slug) => {
    body += urlEntry(origin, '/events/' + encodeURIComponent(slug), lastmod);
  });

  const organiserSlugs = new Set();
  const organiserIdsWithPublicEvents = new Set(
    (events || []).map((row) => row.organiser_id).filter(Boolean)
  );
  organiserIdsWithPublicEvents.forEach((orgId) => {
    const row = orgById.get(orgId);
    if (!row) return;
    const name = String(row.name || '').trim();
    if (!name) return;
    const slug = publicOrganiserSlug(row);
    if (!slug || organiserSlugs.has(slug)) return;
    organiserSlugs.add(slug);
    body += urlEntry(
      origin,
      '/organisers/' + encodeURIComponent(slug),
      isoDate(row.created_at)
    );
  });

  const { listingPaymentCurrent } = require('./opportunity-listing-pricing');
  const opportunitySlugs = new Set();
  (opportunityRows.data || [])
    .filter((row) => listingPaymentCurrent(row))
    .forEach((row) => {
      const slug = publicOpportunitySlug(row);
      if (!slug || opportunitySlugs.has(slug)) return;
      opportunitySlugs.add(slug);
      body += urlEntry(
        origin,
        '/opportunities/' + encodeURIComponent(slug),
        isoDate(row.updated_at || row.published_at || row.created_at)
      );
    });

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    body +
    '</urlset>\n'
  );
}

async function buildSitemapXml(originOverride) {
  const origin = siteOrigin(originOverride);
  const hit = sitemapCache.get(origin);
  if (hit && hit.xml && hit.expires > Date.now()) return hit.xml;
  if (hit && hit.inflight) return hit.inflight;

  const inflight = buildSitemapXmlUncached(origin)
    .then((xml) => {
      sitemapCache.set(origin, {
        expires: Date.now() + SITEMAP_CACHE_TTL_MS,
        xml,
        inflight: null,
      });
      return xml;
    })
    .catch((err) => {
      const current = sitemapCache.get(origin);
      // Serve a briefly-stale sitemap if a rebuild fails after a successful build.
      if (current && current.xml) {
        current.inflight = null;
        current.expires = Date.now() + 60_000;
        return current.xml;
      }
      if (current && current.inflight) sitemapCache.delete(origin);
      throw err;
    });

  sitemapCache.set(origin, {
    expires: hit && hit.expires ? hit.expires : 0,
    xml: hit && hit.xml ? hit.xml : null,
    inflight,
  });
  return inflight;
}

function clearSitemapCache() {
  sitemapCache.clear();
}

module.exports = {
  STATIC_PATHS,
  buildSitemapXml,
  clearSitemapCache,
};
