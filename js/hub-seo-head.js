/**
 * Injects dynamic title, meta, canonical, Open Graph, and JSON-LD for event, organiser, and opportunity pages.
 */
(function () {
  if (document.documentElement.hasAttribute('data-hub-seo-injected')) return;

  function detectTarget() {
    var params = new URLSearchParams(window.location.search);
    var slug = String(params.get('slug') || params.get('id') || '').trim();
    var path = (window.location.pathname || '').replace(/\/$/, '');

    if (slug && /event\.html$/i.test(path)) {
      return { type: 'event', slug: slug };
    }
    if (slug && /organiser\.html$/i.test(path)) {
      return { type: 'organiser', slug: slug };
    }
    if (slug && /opportunity\.html$/i.test(path)) {
      return { type: 'opportunity', slug: slug };
    }

    var eventMatch = path.match(/\/events\/([^/]+)$/);
    if (eventMatch && eventMatch[1] && eventMatch[1] !== 'index.html' && eventMatch[1] !== 'booking-success') {
      return { type: 'event', slug: decodeURIComponent(eventMatch[1]) };
    }

    var orgMatch = path.match(/\/organisers\/([^/]+)$/);
    if (orgMatch && orgMatch[1]) {
      return { type: 'organiser', slug: decodeURIComponent(orgMatch[1]) };
    }

    var oppMatch = path.match(/\/opportunities\/([^/]+)$/);
    if (
      oppMatch &&
      oppMatch[1] &&
      oppMatch[1] !== 'index.html' &&
      oppMatch[1] !== 'list' &&
      oppMatch[1] !== 'browse.html'
    ) {
      return { type: 'opportunity', slug: decodeURIComponent(oppMatch[1]) };
    }

    return null;
  }

  function upsertMeta(attr, key, value) {
    if (!value) return;
    var selector = attr === 'name' ? 'meta[name="' + key + '"]' : 'meta[property="' + key + '"]';
    var el = document.querySelector(selector);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', value);
  }

  function upsertCanonical(href) {
    if (!href) return;
    var el = document.querySelector('link[rel="canonical"]');
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', 'canonical');
      document.head.appendChild(el);
    }
    el.setAttribute('href', href);
  }

  function injectSchema(schema) {
    if (!schema) return;
    var el = document.createElement('script');
    el.type = 'application/ld+json';
    el.setAttribute('data-hub-seo-dynamic', 'true');
    el.textContent = JSON.stringify(schema);
    document.head.appendChild(el);
  }

  function applyMeta(data) {
    if (!data || !data.ok) return;
    if (data.title) document.title = data.title;
    upsertMeta('name', 'description', data.description);
    upsertCanonical(data.canonical);
    var og = data.openGraph || {};
    Object.keys(og).forEach(function (key) {
      if (!og[key]) return;
      var attr = key.indexOf('twitter:') === 0 ? 'name' : 'property';
      upsertMeta(attr, key, og[key]);
    });
    injectSchema(data.schema);
  }

  var target = detectTarget();
  if (!target) return;

  fetch(
    '/api/seo-meta?type=' +
      encodeURIComponent(target.type) +
      '&slug=' +
      encodeURIComponent(target.slug),
    { credentials: 'omit' }
  )
    .then(function (res) {
      return res.json();
    })
    .then(applyMeta)
    .catch(function () {
      /* non-fatal */
    });
})();
