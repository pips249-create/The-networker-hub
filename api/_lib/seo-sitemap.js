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

const STATIC_PATHS = [
  '/',
  '/events/',
  '/opportunities/',
  '/guides',
  '/guides/list-an-event',
  '/guides/list-a-conference-or-exhibition',
  '/guides/list-a-business-opportunity',
  '/guides/invite-your-team',
  '/faq',
  '/help/organiser-payouts',
  '/help/pricing-fees',
  '/contact',
  '/about',
  '/for-organisers',
  '/for-attendees',
  '/advertising',
  '/legal-policies',
  ...NETWORKING_REGION_SLUGS.map((slug) => '/networking/' + slug),
];

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

async function fetchAllOrganiserRows(sb) {
  const rows = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await sb
      .from('organisers')
      // organisers has created_at only (no updated_at column)
      .select('id, name, slug, created_at')
      .order('name')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

function isoDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

async function buildSitemapXml(originOverride) {
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
  const [eventRows, organisers, opportunityRows] = await Promise.all([
    fetchPublishedEventRows(sb),
    fetchAllOrganiserRows(sb),
    sb
      .from('business_opportunities')
      .select('id, title, slug, updated_at, published_at, status, approval_status, listing_expires_at')
      .eq('status', 'published')
      .eq('approval_status', 'Approved')
      .order('published_at', { ascending: false, nullsFirst: false }),
  ]);
  if (opportunityRows.error) throw new Error(opportunityRows.error.message);

  const orgIds = [...new Set((eventRows || []).map((row) => row.organiser_id).filter(Boolean))];
  let orgById = new Map();
  if (orgIds.length) {
    const { data: orgs, error: orgErr } = await sb.from('organisers').select('*').in('id', orgIds);
    if (orgErr) throw new Error(orgErr.message);
    orgById = new Map((orgs || []).map((o) => [o.id, o]));
  }

  const events = (eventRows || []).filter((row) => {
    const org = row.organiser_id ? orgById.get(row.organiser_id) : null;
    return isPublicEvent(row, org);
  });

  const organiserIdsWithPublicEvents = new Set(
    (events || []).map((row) => row.organiser_id).filter(Boolean)
  );

  const eventSlugs = new Set();
  (events || []).forEach((row) => {
    const slug = publicEventSlug({ slug: row.slug, title: row.title });
    if (!slug) return;
    eventSlugs.add(slug);
    body += urlEntry(
      origin,
      '/events/' + encodeURIComponent(slug),
      isoDate(row.updated_at || row.starts_at || row.created_at)
    );
  });

  const organiserSlugs = new Set();
  (organisers || []).forEach((row) => {
    if (!organiserIdsWithPublicEvents.has(row.id)) return;
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

module.exports = {
  STATIC_PATHS,
  buildSitemapXml,
};
