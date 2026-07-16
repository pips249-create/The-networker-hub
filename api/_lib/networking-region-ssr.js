/**
 * Server-rendered event listings for /networking/:region pages (SEO crawlers).
 */
const { getNetworkingRegion } = require('./networking-regions');
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { fetchBrowseEventsPage } = require('./browse-events-query');
const { publicEventSlug } = require('./event-slug');
const { siteOrigin } = require('./hubert-seo');

const SSR_LIMIT = 24;

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function eventDetailPath(ev) {
  const slug = publicEventSlug(ev) || ev.slug;
  if (!slug) return '/events/';
  return '/events/' + encodeURIComponent(slug);
}

function eventLocationLine(ev) {
  return [ev.city, ev.location || ev.locationShort, ev.venue].filter(Boolean)[0] || '';
}

function eventMetaLine(ev) {
  const parts = [ev.date, eventLocationLine(ev), ev.price].filter(Boolean);
  return parts.join(' · ');
}

function buildListingsHtml(events, origin, region, total) {
  const regionName = escapeHtml(region.name);
  const count = Number(total) || events.length;

  if (!events.length) {
    return (
      '<div class="event-listings hub-region-ssr-listings" id="event-listings" data-hub-ssr-listings="1">' +
      '<p class="hub-region-ssr-empty">No upcoming networking events in ' +
      regionName +
      ' yet. <a href="/for-organisers">List your event</a> or <a href="/events/">browse all UK events</a>.</p>' +
      '</div>'
    );
  }

  const items = events
    .map(function (ev) {
      const href = escapeHtml(eventDetailPath(ev));
      const title = escapeHtml(ev.title || 'Networking event');
      const meta = escapeHtml(eventMetaLine(ev));
      return (
        '<li class="hub-region-ssr-item">' +
        '<article class="hub-region-ssr-card">' +
        '<h3 class="hub-region-ssr-title"><a href="' +
        href +
        '">' +
        title +
        '</a></h3>' +
        (meta ? '<p class="hub-region-ssr-meta">' + meta + '</p>' : '') +
        '</article></li>'
      );
    })
    .join('');

  const eventsUrl =
    escapeHtml(siteOrigin(origin) + '/events/?location=' + encodeURIComponent(region.location || region.name));

  return (
    '<div class="event-listings hub-region-ssr-listings" id="event-listings" data-hub-ssr-listings="1">' +
    '<ul class="hub-region-ssr-events" aria-label="Upcoming networking events in ' +
    regionName +
    '">' +
    items +
    '</ul>' +
    (count > events.length
      ? '<p class="hub-region-ssr-more"><a href="' +
        eventsUrl +
        '">View all ' +
        count +
        ' events in ' +
        regionName +
        '</a></p>'
      : '') +
    '</div>'
  );
}

function buildItemListSchema(events, origin, canonical) {
  if (!events.length) return null;

  const base = siteOrigin(origin);
  return {
    '@type': 'ItemList',
    '@id': canonical + '#events',
    name: 'Upcoming networking events',
    numberOfItems: events.length,
    itemListElement: events.map(function (ev, index) {
      const slug = publicEventSlug(ev) || ev.slug;
      const url = slug ? base + '/events/' + encodeURIComponent(slug) : canonical;
      return {
        '@type': 'ListItem',
        position: index + 1,
        name: ev.title || 'Networking event',
        url,
      };
    }),
  };
}

async function buildNetworkingRegionSsr(slug, origin) {
  const region = getNetworkingRegion(slug);
  if (!region) {
    return { listingsHtml: '', total: 0, itemList: null };
  }

  if (!isSupabaseConfigured()) {
    return {
      listingsHtml: buildListingsHtml([], origin, region, 0),
      total: 0,
      itemList: null,
    };
  }

  try {
    const sb = getSupabaseAdmin();
    const payload = await fetchBrowseEventsPage(sb, {
      location: region.location || region.name,
      limit: SSR_LIMIT,
      page: 1,
      meta: '0',
      sort: 'date',
    });
    const events = (payload.events || []).slice();
    const total = payload.pagination ? Number(payload.pagination.total) || events.length : events.length;
    const canonical = siteOrigin(origin) + region.path;

    return {
      listingsHtml: buildListingsHtml(events, origin, region, total),
      total,
      itemList: buildItemListSchema(events, origin, canonical),
    };
  } catch (e) {
    console.error('networking_region_ssr_failed', e && e.message ? e.message : e);
    return {
      listingsHtml: buildListingsHtml([], origin, region, 0),
      total: 0,
      itemList: null,
    };
  }
}

module.exports = {
  SSR_LIMIT,
  buildNetworkingRegionSsr,
  buildListingsHtml,
  buildItemListSchema,
};
