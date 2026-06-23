/**
 * Stash event card image/title before navigating to an event page — used by the load overlay.
 */
(function (global) {
  const STORAGE_KEY = 'hub_event_preview';
  const PLACEHOLDER = '../assets/event-placeholder.svg';

  function parseEventLink(link) {
    const href = String(link.getAttribute('href') || '').trim();
    if (!href) return null;

    let url;
    try {
      url = new URL(href, global.location.origin);
    } catch {
      return null;
    }

    const path = url.pathname.replace(/\/+$/, '');
    const pretty = path.match(/\/events\/([^/]+)$/i);
    if (pretty) {
      const segment = decodeURIComponent(pretty[1]);
      if (segment === 'index.html' || segment === 'event.html' || segment === 'booking-success.html') {
        return null;
      }
      return { slug: segment, id: url.searchParams.get('id') || '' };
    }

    if (path.endsWith('/events/event.html') || path.endsWith('/event.html')) {
      return {
        slug: url.searchParams.get('slug') || '',
        id: url.searchParams.get('id') || '',
      };
    }

    return null;
  }

  function readTitle(link) {
    const titleEl = link.querySelector(
      '.event-grid-title, .premium-card-title, .premium-title, h2, h3'
    );
    if (titleEl) return String(titleEl.textContent || '').trim();
    const card = link.closest('[data-id]');
    if (card && card.getAttribute('data-title')) return String(card.getAttribute('data-title')).trim();
    return '';
  }

  function readImage(link) {
    const img = link.querySelector('img');
    if (!img) return '';
    return String(img.currentSrc || img.src || '').trim();
  }

  function stash(preview) {
    if (!preview || (!preview.id && !preview.slug)) return;
    try {
      global.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(preview));
    } catch {
      /* ignore */
    }
  }

  function stashFromLink(link) {
    const route = parseEventLink(link);
    if (!route) return;
    const card = link.closest('[data-id]');
    stash({
      id: route.id || (card ? String(card.getAttribute('data-id') || '').trim() : ''),
      slug: route.slug || '',
      image: readImage(link),
      title: readTitle(link),
    });
  }

  function read() {
    try {
      const raw = global.sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function readForRoute(route) {
    const preview = read();
    if (!preview) return null;
    const id = route && route.id ? String(route.id).trim() : '';
    const slug = route && route.slug ? String(route.slug).trim().toLowerCase() : '';
    if (id && preview.id && preview.id === id) return preview;
    if (slug && preview.slug && String(preview.slug).trim().toLowerCase() === slug) return preview;
    return null;
  }

  function applyToOverlay(overlayId, preview) {
    const overlay = document.getElementById(overlayId);
    if (!overlay) return;
    const img = overlay.querySelector('.hub-page-buffer-visual');
    const message = overlay.querySelector('.hub-page-buffer-message');
    if (img) {
      if (preview && preview.image) {
        img.src = preview.image;
        img.alt = preview.title || 'Event';
        img.classList.add('is-event-photo');
      } else {
        resetOverlayImage(img);
      }
    }
    if (message) {
      message.textContent =
        preview && preview.title
          ? "We're fetching details for " + preview.title + ' — bear with us, it won\'t take long.'
          : "We're fetching the details — bear with us, it won't take long.";
    }
  }

  function resetOverlayImage(img) {
    if (!img) return;
    img.classList.remove('is-event-photo');
    img.src = img.getAttribute('data-default-src') || PLACEHOLDER;
    img.alt = '';
  }

  function resetOverlay(overlayId) {
    const overlay = document.getElementById(overlayId);
    if (!overlay) return;
    resetOverlayImage(overlay.querySelector('.hub-page-buffer-visual'));
    const message = overlay.querySelector('.hub-page-buffer-message');
    if (message) {
      message.textContent = "We're fetching the details — bear with us, it won't take long.";
    }
  }

  function bindClicks() {
    document.addEventListener(
      'click',
      function (e) {
        const link = e.target.closest('a[href]');
        if (!link) return;
        if (link.target === '_blank' || link.hasAttribute('download')) return;
        const route = parseEventLink(link);
        if (!route) return;
        stashFromLink(link);
      },
      true
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindClicks);
  } else {
    bindClicks();
  }

  global.hubEventPreview = {
    stash,
    stashFromLink,
    read,
    readForRoute,
    applyToOverlay,
    resetOverlay,
    bindClicks,
  };
})(typeof window !== 'undefined' ? window : globalThis);
