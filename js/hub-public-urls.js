/**
 * Canonical public URLs for listings (client-side).
 * Matches api/_lib/hub-email-urls.js and vercel.json rewrites.
 */
(function (global) {
  function slugifyTitle(title) {
    return String(title || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 96);
  }

  function eventDetailHref(ev) {
    var slug = ev && ev.slug ? String(ev.slug).trim() : '';
    if (slug) return '/events/' + encodeURIComponent(slug);
    var id = ev && ev.id ? String(ev.id).trim() : '';
    if (id) return '/events/event?id=' + encodeURIComponent(id);
    return '/events/';
  }

  function organiserDetailHref(org) {
    var slug = org && org.slug ? String(org.slug).trim() : '';
    if (slug) return '/organisers/' + encodeURIComponent(slug);
    var id = org && org.id ? String(org.id).trim() : '';
    if (id) return '/events/organiser?id=' + encodeURIComponent(id);
    return '/events/#organisers';
  }

  function opportunityDetailHref(item) {
    var slug = item && item.slug ? String(item.slug).trim() : '';
    if (!slug && item && item.title) slug = slugifyTitle(item.title);
    if (slug) return '/opportunities/' + encodeURIComponent(slug);
    var id =
      typeof item === 'string'
        ? item
        : item && (item.id || item.opportunity_id || item.opportunityId);
    id = id ? String(id).trim() : '';
    if (!id) return '/opportunities/';
    return '/opportunities/' + encodeURIComponent(id);
  }

  global.HubPublicUrls = {
    home: '/',
    eventsBrowse: '/events/',
    opportunitiesBrowse: '/opportunities/',
    organisersBrowse: '/events/#organisers',
    advertising: '/advertising',
    eventDetailHref: eventDetailHref,
    organiserDetailHref: organiserDetailHref,
    opportunityDetailHref: opportunityDetailHref,
    slugifyTitle: slugifyTitle,
  };
})(typeof window !== 'undefined' ? window : globalThis);
