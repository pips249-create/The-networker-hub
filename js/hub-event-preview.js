/**
 * Stash event card image/title before navigating to an event page — used by the load overlay.
 */
(function (global) {
  const STORAGE_KEY = 'hub_event_preview';
  const PLACEHOLDER = '../assets/event-placeholder.svg';
  const POSITION_RE = /^\d{1,3}%\s+\d{1,3}%$/;

  function normalizePosition(value) {
    const pos = String(value || '').trim();
    return POSITION_RE.test(pos) ? pos : '';
  }

  function findCardRoot(link) {
    return link.closest('.event-grid-card, .premium-card, [data-id]');
  }

  function findCardImage(link) {
    const inLink = link.querySelector('img');
    if (inLink) return inLink;
    const card = findCardRoot(link);
    if (!card) return null;
    return card.querySelector('.event-grid-img, .premium-card-img, img');
  }

  function lookupEventById(eventId) {
    const needle = String(eventId || '').trim();
    if (!needle) return null;
    const pools = [global.hubBrowseEvents, global.hubAllEvents, global.events].filter(Array.isArray);
    for (let i = 0; i < pools.length; i++) {
      const found = pools[i].find(function (ev) {
        return ev && String(ev.id) === needle;
      });
      if (found) return found;
    }
    return null;
  }

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

    if (path.endsWith('/events/event') || path.endsWith('/event.html')) {
      return {
        slug: url.searchParams.get('slug') || '',
        id: url.searchParams.get('id') || '',
      };
    }

    return null;
  }

  function readTitle(link) {
    const card = findCardRoot(link);
    const titleEl =
      link.querySelector('.event-grid-title, .premium-card-title, .premium-title, h2, h3') ||
      (card &&
        card.querySelector('.event-grid-title, .premium-card-title, .premium-title, h2, h3'));
    if (titleEl) return String(titleEl.textContent || '').trim();
    if (card && card.getAttribute('data-title')) return String(card.getAttribute('data-title')).trim();
    return '';
  }

  function readImage(link) {
    const img = findCardImage(link);
    if (!img) return '';
    return String(img.currentSrc || img.src || '').trim();
  }

  function readImagePosition(link, imgEl) {
    const img = imgEl || findCardImage(link);
    if (img && !img.classList.contains('is-logo-cover')) {
      const inline = normalizePosition(img.style.objectPosition);
      if (inline) return inline;
      try {
        const computed = global.getComputedStyle(img).objectPosition || '';
        const parts = computed.trim().split(/\s+/);
        if (parts.length >= 2) {
          const normalized = normalizePosition(parts[0] + ' ' + parts[1]);
          if (normalized && normalized !== '50% 50%') return normalized;
        }
      } catch {
        /* ignore */
      }
    }
    const card = findCardRoot(link);
    const eventId = card ? String(card.getAttribute('data-id') || '').trim() : '';
    const ev = lookupEventById(eventId);
    if (ev) return normalizePosition(ev.photoPosition || ev.imagePosition);
    return '';
  }

  function applyImagePosition(img, position) {
    if (!img) return;
    const pos = normalizePosition(position);
    img.style.objectPosition = pos || '';
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
    const card = findCardRoot(link);
    const cardImg = findCardImage(link);
    stash({
      id: route.id || (card ? String(card.getAttribute('data-id') || '').trim() : ''),
      slug: route.slug || '',
      image: readImage(link),
      imagePosition: readImagePosition(link, cardImg),
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
        applyImagePosition(img, preview.imagePosition);
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
    img.style.objectPosition = '';
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
