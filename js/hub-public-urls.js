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
    var uuidLike =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slug);
    if (slug && !uuidLike) return '/events/' + encodeURIComponent(slug);
    var id = ev && ev.id ? String(ev.id).trim() : '';
    /* .html avoids /events/:slug rewrite swallowing path "event" and dropping ?id= */
    if (id) return '/events/event.html?id=' + encodeURIComponent(id);
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
    isPlatformWebsiteUrl: isPlatformWebsiteUrl,
  };

  function isPlatformWebsiteUrl(input) {
    var raw = String(input || '').trim();
    if (!raw) return false;
    var url = raw;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try {
      var host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
      if (
        host === 'thenetworkeruk.com' ||
        host === 'thenetworkerinternational.com' ||
        host === 'thenetworkerireland.com' ||
        host === 'thenetworkerusa.com' ||
        host === 'thenetworkerhub.com' ||
        host === 'thenetworkerhub.co.uk' ||
        host === 'the-networker.co.uk' ||
        host === 'the-networker.com' ||
        /\.vercel\.app$/.test(host)
      ) {
        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  }
})(typeof window !== 'undefined' ? window : globalThis);
