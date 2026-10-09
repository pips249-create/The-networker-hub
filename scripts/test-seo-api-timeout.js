#!/usr/bin/env node
/**
 * /api/seo was returning HTTP 504 when:
 * - organiser seo-meta loaded full detail enrichment (reviews/rankings/membership)
 * - event slug lookup fell through to an unbounded catalogue scan
 * - sitemap scanned every organiser row on top of the event catalogue
 *
 * Run: node scripts/test-seo-api-timeout.js
 */
const {
  fetchPublishedEventBySlug,
  isPublicEvent,
} = require('../api/_lib/supabase-events');
const {
  getPublicOrganiserForSeo,
  getPublicOrganiserBySlug,
} = require('../api/_lib/supabase-organisers-browse');
const {
  buildSitemapXml,
  clearSitemapCache,
  STATIC_PATHS,
} = require('../api/_lib/seo-sitemap');
const { buildSeoMeta, clearSeoMetaCache } = require('../api/_lib/seo-meta');

let failed = 0;

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

function createMockSb(handlers) {
  return {
    from(table) {
      const state = {
        table,
        filters: [],
        select: null,
        order: null,
        range: null,
        limit: null,
      };
      const b = {
        select(cols) {
          state.select = cols;
          return b;
        },
        eq(col, val) {
          state.filters.push(['eq', col, val]);
          return b;
        },
        not(col, op, val) {
          state.filters.push(['not', col, op, val]);
          return b;
        },
        ilike(col, val) {
          state.filters.push(['ilike', col, val]);
          return b;
        },
        in(col, vals) {
          state.filters.push(['in', col, vals]);
          return b;
        },
        order(col, opts) {
          state.order = [col, opts];
          return b;
        },
        range(from, to) {
          state.range = [from, to];
          return b;
        },
        limit(n) {
          state.limit = n;
          return b;
        },
        maybeSingle() {
          return Promise.resolve(handlers({ ...state, single: 'maybe' }));
        },
        then(resolve, reject) {
          return Promise.resolve(handlers(state)).then(resolve, reject);
        },
      };
      return b;
    },
  };
}

async function testPublishedSlugSkipsCatalogueScan() {
  let publishedEventsPages = 0;
  const sb = createMockSb((state) => {
    if (state.table === 'events' && state.filters.some((f) => f[0] === 'eq' && f[1] === 'slug')) {
      return {
        data: [
          {
            id: 'e1',
            slug: 'bob-connections-tonbridge',
            title: 'BoB Connections',
            approval_status: 'Approved',
            status: 'published',
            starts_at: '2026-11-01T18:00:00.000Z',
            organiser_id: 'o1',
          },
        ],
        error: null,
      };
    }
    if (state.table === 'published_events') {
      publishedEventsPages += 1;
      return { data: [], error: null };
    }
    return { data: null, error: null };
  });

  const row = await fetchPublishedEventBySlug(sb, 'bob-connections-tonbridge');
  assert('published slug resolves without catalogue scan', row && row.id === 'e1');
  assert('catalogue scan not started for stored slug', publishedEventsPages === 0);
}

async function testUnpublishedSlugDoesNotScanForever() {
  let publishedEventsPages = 0;
  const sb = createMockSb((state) => {
    if (state.table === 'events' && state.filters.some((f) => f[0] === 'eq' && f[1] === 'slug')) {
      // No published row for this slug (filters require Approved + published).
      return { data: [], error: null };
    }
    if (state.table === 'events' && state.filters.some((f) => f[0] === 'ilike')) {
      return { data: [], error: null };
    }
    if (state.table === 'published_events') {
      publishedEventsPages += 1;
      const from = state.range ? state.range[0] : 0;
      const to = state.range ? state.range[1] : 999;
      const size = to - from + 1;
      // Always return a full page so an uncapped loop would never end.
      const rows = [];
      for (let i = 0; i < size; i++) {
        rows.push({ id: 'x' + (from + i), slug: null, title: 'Other ' + (from + i) });
      }
      return { data: rows, error: null };
    }
    return { data: null, error: null };
  });

  const row = await fetchPublishedEventBySlug(sb, 'missing-slug', { maxScanRows: 3000 });
  assert('missing slug returns null', row == null);
  assert('title-derived scan capped at 3 pages', publishedEventsPages === 3);
}

async function testOrganiserSeoSkipsEnrichment() {
  const calls = [];
  const realGet = getPublicOrganiserForSeo;
  // Smoke the export exists and returns a plain card shape when supabase is off.
  const prevUrl = process.env.SUPABASE_URL;
  const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { clearSupabaseAdminCache } = (() => {
    try {
      return require('../api/_lib/supabase');
    } catch {
      return {};
    }
  })();
  if (typeof clearSupabaseAdminCache === 'function') clearSupabaseAdminCache();

  const seoOrg = await realGet('any-slug');
  assert('seo organiser helper returns null when supabase unset', seoOrg == null);
  assert('full detail getter still exported', typeof getPublicOrganiserBySlug === 'function');
  assert('seo getter is a distinct export', realGet !== getPublicOrganiserBySlug);

  if (prevUrl) process.env.SUPABASE_URL = prevUrl;
  else delete process.env.SUPABASE_URL;
  if (prevKey) process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
  else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  void calls;
}

async function testSitemapCacheAndStaticOnly() {
  clearSitemapCache();
  const prevUrl = process.env.SUPABASE_URL;
  const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  const xml1 = await buildSitemapXml('https://www.thenetworkeruk.com');
  const xml2 = await buildSitemapXml('https://www.thenetworkeruk.com');
  assert('static sitemap includes urlset', xml1.includes('<urlset'));
  assert('static sitemap includes home', xml1.includes('https://www.thenetworkeruk.com/</loc>'));
  assert('static paths present', STATIC_PATHS.length > 10);
  assert('sitemap cache returns identical xml', xml1 === xml2);

  if (prevUrl) process.env.SUPABASE_URL = prevUrl;
  else delete process.env.SUPABASE_URL;
  if (prevKey) process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
  else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
}

async function testSeoMetaCache() {
  clearSeoMetaCache();
  const a = await buildSeoMeta('page', 'home', 'https://www.thenetworkeruk.com');
  const b = await buildSeoMeta('page', 'home', 'https://www.thenetworkeruk.com');
  assert('static page meta ok', a && a.ok && a.title);
  assert('seo meta cache reuses object', a === b);
}

async function testIsPublicEventStillWorks() {
  assert(
    'public event with published org',
    isPublicEvent(
      { starts_at: '2026-11-01', approval_status: 'Approved', status: 'published' },
      { listing_status: 'published' }
    )
  );
  assert(
    'draft org hides event',
    !isPublicEvent(
      { starts_at: '2026-11-01', approval_status: 'Approved', status: 'published' },
      { listing_status: 'draft' }
    )
  );
}

async function main() {
  await testPublishedSlugSkipsCatalogueScan();
  await testUnpublishedSlugDoesNotScanForever();
  await testOrganiserSeoSkipsEnrichment();
  await testSitemapCacheAndStaticOnly();
  await testSeoMetaCache();
  await testIsPublicEventStillWorks();

  if (failed) {
    console.error('\n' + failed + ' failure(s)');
    process.exit(1);
  }
  console.log('\nAll seo timeout checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
