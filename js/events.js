/**
 * Loads event listings from /api/hub-listings (Supabase or Airtable via Vercel).
 */
(function () {
  const API_PATHS = ['/api/hub-listings', '/api/events'];
  const PAGE_SIZE = 12;

  const els = {
    status: document.getElementById('load-status'),
    featuredList: document.getElementById('featured-list'),
    spotlightTrack: document.getElementById('spotlight-track'),
    listings: document.getElementById('event-listings'),
    resultsCount: document.getElementById('results-count'),
    location: document.getElementById('location'),
  };

  let events = [];
  let currentPage = 1;
  let spotlightPremiumOrder = null;
  let spotlightFilterKey = '';
  let spotlightTimer = null;
  let spotlightAnimating = false;
  let spotlightCarouselBound = false;
  const SPOTLIGHT_AUTO_MS = 2800;

  function shuffleList(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function resetSpotlightOrder() {
    spotlightPremiumOrder = null;
    spotlightFilterKey = '';
  }

  function spotlightFilterSignature(featured) {
    return featured
      .map(function (ev) {
        return String(ev.id || ev.slug || ev.title || '');
      })
      .sort()
      .join('|');
  }

  function hasAnyFeaturedEvents() {
    const source = window.hubAllEvents && window.hubAllEvents.length ? window.hubAllEvents : events;
    return source.some(function (ev) {
      return ev.featured;
    });
  }

  function stopSpotlightAuto() {
    if (spotlightTimer) {
      clearInterval(spotlightTimer);
      spotlightTimer = null;
    }
  }

  function startSpotlightAuto() {
    stopSpotlightAuto();
    if (!els.spotlightTrack) return;
    const premium = getSpotlightPremium();
    if (premium.length <= 1) return;
    spotlightTimer = window.setInterval(function () {
      if (document.hidden || spotlightAnimating) return;
      advanceSpotlight(1);
    }, SPOTLIGHT_AUTO_MS);
  }

  function getSpotlightCardStep() {
    const track = els.spotlightTrack;
    if (!track) return 274;
    const card = track.querySelector('.premium-card');
    if (!card) return 274;
    const gap = parseFloat(getComputedStyle(track).gap) || 14;
    return card.getBoundingClientRect().width + gap;
  }

  function measureSpotlightLoopWidth() {
    const track = els.spotlightTrack;
    const premium = getSpotlightPremium();
    if (!track || !premium.length) return 0;

    const cards = track.querySelectorAll('.premium-card');
    if (!cards.length) return 0;

    const gap = parseFloat(getComputedStyle(track).gap) || 14;
    let width = 0;
    const count = Math.min(premium.length, cards.length);

    for (let i = 0; i < count; i++) {
      width += cards[i].getBoundingClientRect().width;
      if (i < count - 1) width += gap;
    }

    return width;
  }

  function syncSpotlightLoopScroll() {
    const track = els.spotlightTrack;
    if (!track) return;
    const loopWidth = measureSpotlightLoopWidth();
    if (!loopWidth) return;

    track.dataset.loopWidth = String(loopWidth);

    if (track.scrollLeft >= loopWidth) {
      track.scrollLeft = track.scrollLeft - loopWidth;
    }
  }

  function advanceSpotlight(dir) {
    dir = dir < 0 ? -1 : 1;
    const premium = getSpotlightPremium();
    const track = els.spotlightTrack;
    if (!premium.length || premium.length <= 1 || !track || spotlightAnimating) return;

    spotlightAnimating = true;
    stopSpotlightAuto();

    const step = getSpotlightCardStep() * dir;
    const loopWidth = parseFloat(track.dataset.loopWidth) || measureSpotlightLoopWidth();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior = reduceMotion ? 'auto' : 'smooth';

    function finishAdvance() {
      syncSpotlightLoopScroll();
      spotlightAnimating = false;
      startSpotlightAuto();
    }

    if (dir < 0 && track.scrollLeft <= 4 && loopWidth > 0) {
      track.scrollLeft = loopWidth;
    }

    track.scrollBy({ left: step, behavior: behavior });
    window.setTimeout(finishAdvance, reduceMotion ? 0 : 380);
  }

  function bindSpotlightCarousel() {
    if (spotlightCarouselBound) return;
    spotlightCarouselBound = true;

    const wrap = document.querySelector('.spotlight-wrap');
    const prev = document.getElementById('spotlight-prev');
    const next = document.getElementById('spotlight-next');

    if (prev) {
      prev.addEventListener('click', function () {
        advanceSpotlight(-1);
      });
    }
    if (next) {
      next.addEventListener('click', function () {
        advanceSpotlight(1);
      });
    }
    if (wrap) {
      wrap.addEventListener('mouseenter', stopSpotlightAuto);
      wrap.addEventListener('mouseleave', startSpotlightAuto);
    }

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (!spotlightAnimating) {
          syncSpotlightLoopScroll();
        }
      }, 200);
    });
  }

  function getSpotlightPremium() {
    const featured = getFilteredList().filter(function (ev) {
      return ev.featured;
    });
    const key = spotlightFilterSignature(featured);
    if (key !== spotlightFilterKey || !spotlightPremiumOrder) {
      spotlightFilterKey = key;
      spotlightPremiumOrder = shuffleList(featured);
    }
    return spotlightPremiumOrder;
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function safePhotoUrl(url) {
    if (!url) return '';
    return String(url)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function jsPhotoUrl(url) {
    if (!url) return '';
    return String(url).replace(/\\/g, '\\\\').replace(/'/g, '\\\'');
  }

  function eventImageSrc(ev) {
    if (window.getEventBrowseImage) return window.getEventBrowseImage(ev);
    if (window.getEventImage) return window.getEventImage(ev);
    if (window.getFlexibleEventImage) {
      return window.getFlexibleEventImage(ev.photo, ev.organiserLogo, ev.id);
    }
    return ev.photo || ev.organiserLogo || '';
  }

  function defaultPlaceholder() {
    if (window.getDefaultEventPlaceholder) return window.getDefaultEventPlaceholder();
    return '/assets/placeholders/default.svg';
  }

  function isPlaceholderSrc(url) {
    return /\/assets\/placeholders\//i.test(url) || /event-placeholder/i.test(url);
  }

  function isLogoStyleCover(ev, url) {
    if (window.hubIsLogoStyleCover) return window.hubIsLogoStyleCover(ev, url);
    const photo = String(url || '').trim();
    const logo = ev && ev.organiserLogo ? String(ev.organiserLogo).trim() : '';
    return Boolean(photo && logo && photo === logo);
  }

  function photoImg(url, className, eventId, eventType, eventTitle, ev) {
    const placementFn = window.getEventPlacementImage;
    const fallbackRaw =
      (placementFn
        ? placementFn(eventId || '', eventType || '', eventTitle || '')
        : window.getEventBrowseImage
          ? window.getEventBrowseImage({ id: eventId, eventType: eventType, title: eventTitle })
          : '') || defaultPlaceholder();
    const resolved = url || fallbackRaw;
    const src = safePhotoUrl(resolved);
    const errorFallback = jsPhotoUrl(defaultPlaceholder());
    const placeholderClass = isPlaceholderSrc(resolved) ? ' is-placeholder' : '';
    const logoCoverClass = isLogoStyleCover(ev, resolved) ? ' is-logo-cover' : '';
    return (
      `<img class="${className}${placeholderClass}${logoCoverClass}" src="${src}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" ` +
      `onload="window.hubMarkSmallEventCover&&window.hubMarkSmallEventCover(this)" ` +
      `onerror="this.onerror=null;this.src='${errorFallback}';this.classList.add('is-placeholder')">`
    );
  }

  function cardLocation(ev) {
    const city = String(ev.city || '').trim();
    if (city) return city.slice(0, 20);
    const outcode = String(ev.outcode || '').trim();
    if (outcode) return outcode.slice(0, 20);
    if (String(ev.format || '').toLowerCase().includes('online')) return 'Online';
    const loc = String(ev.locationShort || ev.location || '').trim();
    if (!loc) return 'TBC';
    const short = loc.split(',')[0].trim() || loc;
    return short.slice(0, 20);
  }

  function slugLocation(loc) {
    if (!loc) return '';
    const s = String(loc).toLowerCase();
    if (s.includes('online')) return 'online';
    return s.replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  }

  function formatTagClass(fmt) {
    const s = String(fmt || '').toLowerCase();
    if (s.includes('online') && !s.includes('person')) return 'online';
    if (s.includes('hybrid')) return 'hybrid';
    return 'in-person';
  }

  function formatTagLabel(fmt) {
    const c = formatTagClass(fmt);
    if (c === 'online') return 'Online';
    if (c === 'hybrid') return 'Hybrid';
    return 'In-person';
  }

  /** Meeting type label for cards (networking, conference, etc. — not online/in-person). */
  function meetingTypeLabel(ev) {
    let raw = ev.eventType || ev.typeRaw || ev.typeCategory || '';
    if (typeof window !== 'undefined' && window.hubNormalizeEventType) {
      raw = window.hubNormalizeEventType(raw);
    }
    const label = String(raw).trim();
    if (!label) return 'Meeting';
    if (label.length > 28) return label.slice(0, 26) + '…';
    return label;
  }

  function priceBadgeLabel(ev) {
    if (window.HubBookingFees) {
      return window.HubBookingFees.listingPriceLabel(ev);
    }
    if (ev.priceKey === 'free' || !ev.price || /^free$/i.test(ev.price)) return 'Free';
    const n = Number(ev.priceNum);
    if (n > 0) {
      const amt = n % 1 === 0 ? '£' + n.toFixed(0) : '£' + n.toFixed(2);
      return 'from ' + amt;
    }
    return ev.price;
  }

  function starsHtml(rating) {
    const avg = Number(rating);
    const full =
      Number.isFinite(avg) && avg > 0 ? Math.min(5, Math.max(0, Math.round(avg))) : 0;
    let html = '';
    for (let i = 1; i <= 5; i++) {
      html += `<span class="star ${i <= full ? 'is-full' : ''}" aria-hidden="true">★</span>`;
    }
    return html;
  }

  function slugifyEventTitle(title) {
    return String(title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 96);
  }

  function publicEventSlug(ev) {
    const stored = ev.slug ? String(ev.slug).trim() : '';
    const uuidLike =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stored);
    if (stored && !uuidLike) return stored;
    return slugifyEventTitle(ev.title) || '';
  }

  function detailHref(ev) {
    const slug = publicEventSlug(ev);
    if (slug) return '/events/' + encodeURIComponent(slug);
    return 'event.html?id=' + encodeURIComponent(ev.id);
  }

  const META_PIN_SVG =
    '<svg class="premium-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';
  const META_CAL_SVG =
    '<svg class="premium-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/></svg>';
  const META_CLOCK_SVG =
    '<svg class="premium-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>';

  function premiumCard(ev) {
    const dateLabel = ev.date || 'Date TBC';
    const timeLabel = ev.time || '';
    return `
      <article class="premium-card" data-id="${escapeHtml(ev.id)}"
        data-type="${escapeHtml(ev.type)}"
        data-search="${escapeHtml(ev.search)}"
        data-location="${escapeHtml(ev.locationSlug)}"
        data-format="${escapeHtml(ev.formatSlug)}"
        data-price="${escapeHtml(ev.priceKey)}">
        <a class="premium-card-link" href="${escapeHtml(detailHref(ev))}">
          <div class="premium-card-media" aria-hidden="true">
            <div class="premium-card-bg">${photoImg(eventImageSrc(ev), 'premium-card-img', ev.id, ev.eventType || ev.typeRaw, ev.title, ev)}</div>
            <div class="premium-card-overlay"></div>
          </div>
          <div class="premium-card-top">
            <span class="premium-badge">Premium</span>
            <span class="premium-price">${escapeHtml(priceBadgeLabel(ev))}</span>
          </div>
          <div class="premium-card-body">
            <h3 class="premium-card-title">${escapeHtml(ev.title)}</h3>
            <div class="premium-card-meta">
              <p class="premium-meta-row">${META_PIN_SVG}<span>${escapeHtml(cardLocation(ev))}</span></p>
              <p class="premium-meta-row">${META_CAL_SVG}<span>${escapeHtml(dateLabel)}${timeLabel ? ' · ' + escapeHtml(timeLabel) : ''}</span></p>
            </div>
          </div>
        </a>
      </article>`;
  }

  function rankingShortLabel(ev) {
    const rank = ev.organiserRanking;
    if (rank && rank.label) {
      return String(rank.label).replace(/\s+networking group$/i, '').trim();
    }
    const raw = String(ev.organiserRankingLabel || '').trim();
    if (!raw) return '';
    return raw.split('·')[0].trim();
  }

  function gridCard(ev) {
    const fmtClass = formatTagClass(ev.format);
    const fmtLabel = formatTagLabel(ev.format);
    const reviewCount = Number(ev.reviews) || 0;
    const meetingType = meetingTypeLabel(ev);
    const dateLine =
      ev.dateLine ||
      [cardLocation(ev), ev.date || ev.dateFieldRaw, ev.time].filter(Boolean).join(' · ') ||
      'Date TBC';
    const premiumBadge = ev.featured
      ? '<span class="event-grid-premium">Premium</span>'
      : '';
    const salesBadge = ev.isTicketSalesScheduled && ev.ticketSalesOpensShort
      ? '<span class="event-grid-sales-pending">Tickets open ' +
        escapeHtml(ev.ticketSalesOpensShort) +
        '</span>'
      : ev.isTicketSalesPending || ev.isTicketSalesScheduled
        ? '<span class="event-grid-sales-pending">Tickets soon</span>'
        : '';
    const rankingShort = rankingShortLabel(ev);
    const rankingBadge =
      !salesBadge && rankingShort
        ? '<span class="event-grid-ranking hub-ranking-badge hub-ranking-badge--' +
          escapeHtml(ev.organiserRanking?.tier || 'top10') +
          '" title="' +
          escapeHtml(ev.organiserRanking?.displayLabel || ev.organiserRankingLabel || rankingShort) +
          '">★ ' +
          escapeHtml(rankingShort) +
          '</span>'
        : '';
    const statusBadge = salesBadge || rankingBadge;

    return `
      <a class="event-grid-card${ev.featured ? ' is-premium' : ''}" href="${escapeHtml(detailHref(ev))}"
        data-id="${escapeHtml(ev.id)}"
        data-type="${escapeHtml(ev.type)}"
        data-search="${escapeHtml(ev.search)}"
        data-location="${escapeHtml(ev.locationSlug)}"
        data-format="${escapeHtml(ev.formatSlug)}"
        data-price="${escapeHtml(ev.priceKey)}">
        <div class="event-grid-media">
          ${photoImg(eventImageSrc(ev), 'event-grid-img', ev.id, ev.eventType || ev.typeRaw, ev.title, ev)}
          ${premiumBadge}
          ${statusBadge}
          <span class="event-grid-category">${escapeHtml(meetingType)}</span>
        </div>
        <div class="event-grid-body">
          <div class="event-grid-body-top">
            <span class="event-grid-format ${escapeHtml(fmtClass)}">${escapeHtml(fmtLabel)}</span>
            <span class="event-grid-price">${escapeHtml(priceBadgeLabel(ev))}</span>
          </div>
          <h3 class="event-grid-title">${escapeHtml(ev.title)}</h3>
          <div class="event-grid-rating">
            <span class="stars">${starsHtml(ev.rating)}</span>
            <span class="review-count">(${reviewCount})</span>
            <button type="button" class="fav-btn" data-event-id="${escapeHtml(ev.id)}" data-organiser-id="${escapeHtml(ev.organiserId || '')}" aria-label="Save event" aria-pressed="false">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
            </button>
          </div>
          <p class="event-grid-meta">${escapeHtml(dateLine)}</p>
        </div>
      </a>`;
  }

  function paginationHtml(page, totalPages) {
    if (totalPages <= 1) return '';

    const items = [];
    const maxVisible = 5;
    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);

    items.push(
      `<button type="button" class="page-btn page-prev" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="Previous page">‹</button>`
    );

    if (start > 1) {
      items.push(`<button type="button" class="page-btn" data-page="1">1</button>`);
      if (start > 2) items.push('<span class="page-ellipsis" aria-hidden="true">…</span>');
    }

    for (let p = start; p <= end; p++) {
      items.push(
        `<button type="button" class="page-btn${p === page ? ' is-active' : ''}" data-page="${p}" ${p === page ? 'aria-current="page"' : ''}>${p}</button>`
      );
    }

    if (end < totalPages) {
      if (end < totalPages - 1) items.push('<span class="page-ellipsis" aria-hidden="true">…</span>');
      items.push(`<button type="button" class="page-btn" data-page="${totalPages}">${totalPages}</button>`);
    }

    items.push(
      `<button type="button" class="page-btn page-next" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''} aria-label="Next page">›</button>`
    );

    return `<nav class="listings-pagination" aria-label="Listings pages">${items.join('')}</nav>`;
  }

  function getFilteredList() {
    return window.hubGetFilteredEvents ? window.hubGetFilteredEvents(events) : events.slice();
  }

  function renderGridPage(list) {
    const rows = list;
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = rows.slice(start, start + PAGE_SIZE);

    if (!els.listings) return;

    if (!rows.length) {
      els.listings.innerHTML =
        '<div class="empty-state is-visible" role="status">' +
        '<div class="empty-state-inner">' +
        '<div class="empty-state-icon" aria-hidden="true">' +
        '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
        '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/>' +
        '<path d="M8 11h6M11 8v6" stroke-linecap="round"/>' +
        '</svg></div>' +
        '<h3 class="empty-state-title">No events match your filters</h3>' +
        '<p class="empty-state-text">Try clearing filters, choosing a different date range, or browsing all event types.</p>' +
        '<button type="button" class="empty-state-btn" id="empty-reset">Clear all filters</button>' +
        '</div></div>';
      if (els.resultsCount) els.resultsCount.textContent = '0';
      return;
    }

    const rangeStart = rows.length ? start + 1 : 0;
    const rangeEnd = Math.min(start + PAGE_SIZE, rows.length);
    const rangeHtml =
      rows.length > PAGE_SIZE
        ? '<p class="listings-range">Showing ' +
          rangeStart +
          '–' +
          rangeEnd +
          ' of ' +
          rows.length +
          '</p>'
        : '';

    els.listings.innerHTML =
      rangeHtml +
      '<div class="event-grid">' +
      pageItems.map(gridCard).join('') +
      '</div>' +
      paginationHtml(currentPage, totalPages);

    if (els.resultsCount) els.resultsCount.textContent = String(rows.length);

    if (window.HubFavourites) window.HubFavourites.refreshButtons(els.listings);
  }

  function initListingsPagination() {
    if (!els.listings || els.listings.dataset.paginationBound) return;
    els.listings.dataset.paginationBound = '1';
    els.listings.addEventListener('click', function (e) {
      if (document.body.classList.contains('browse-mode-organisers')) return;
      const btn = e.target.closest('.page-btn');
      if (!btn || btn.disabled) return;
      const filtered = getFilteredList();
      const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
      const p = parseInt(btn.getAttribute('data-page'), 10);
      if (!p || p === currentPage || p < 1 || p > totalPages) return;
      currentPage = p;
      renderGridPage(filtered);
      const block = document.querySelector('.listings-block');
      if (block) block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  function fillFilterOptions() {
    if (!els.location) return;
    while (els.location.options.length > 1) els.location.remove(1);
    const locations = [...new Set(events.map((e) => e.location).filter(Boolean))].sort();
    locations.forEach((label) => {
      const opt = document.createElement('option');
      opt.value = slugLocation(label);
      opt.textContent = label;
      els.location.appendChild(opt);
    });
  }

  function renderSpotlight() {
    if (document.body.classList.contains('browse-mode-organisers')) return;

    const premium = getSpotlightPremium();

    if (els.spotlightTrack) {
      if (!premium.length) {
        const emptyMsg = hasAnyFeaturedEvents()
          ? 'No premium events match your current filters. Try clearing filters or widening your search area.'
          : 'No premium events yet — set <strong>featured</strong> on approved events in Supabase.';
        els.spotlightTrack.innerHTML = '<p class="spotlight-empty">' + emptyMsg + '</p>';
        els.spotlightTrack.classList.remove('spotlight-track--carousel');
        els.spotlightTrack.removeAttribute('data-loop-width');
        els.spotlightTrack.scrollLeft = 0;
        stopSpotlightAuto();
      } else {
        const cardsHtml = premium.map(premiumCard).join('');
        const loopHtml = premium.length > 1 ? cardsHtml : '';
        els.spotlightTrack.innerHTML = cardsHtml + loopHtml;
        els.spotlightTrack.classList.add('spotlight-track--carousel');
        els.spotlightTrack.scrollLeft = 0;
        bindSpotlightCarousel();
        requestAnimationFrame(function () {
          syncSpotlightLoopScroll();
          startSpotlightAuto();
        });
      }
    }

    if (els.featuredList) {
      els.featuredList.innerHTML = premium.map(premiumCard).join('') || '';
      els.featuredList.closest('.featured')?.classList.toggle('is-hidden', !premium.length);
    }
  }

  function updateCounts() {
    if (window.hubUpdateEventTypeChipCounts) {
      window.hubUpdateEventTypeChipCounts();
    }
  }

  function renderAll() {
    if (document.body.classList.contains('browse-mode-organisers')) return;
    const filtered = getFilteredList();
    renderSpotlight();
    renderGridPage(filtered);
    updateCounts();
  }

  function setLoading(on) {
    if (window.FactLoader) return;
    const shell = document.getElementById('events-shell');
    if (shell) shell.classList.toggle('is-loading', !!on);
  }

  function setStatus(msg, isError) {
    if (!els.status) return;
    els.status.textContent = msg;
    els.status.classList.toggle('is-error', !!isError);
    els.status.hidden = !msg;
  }

  window.hubRefreshListings = function () {
    if (document.body.classList.contains('browse-mode-organisers')) {
      if (window.hubRefreshOrganiserListings) window.hubRefreshOrganiserListings();
      return;
    }
    currentPage = 1;
    renderAll();
    if (window.hubRefreshMap && window.hubGetFilteredEvents) {
      window.hubRefreshMap(window.hubGetFilteredEvents(events));
    }
  };

  function applyLoadedEvents() {
    window.hubAllEvents = events;
    resetSpotlightOrder();
    fillFilterOptions();
    if (window.hubInitPriceFilter) window.hubInitPriceFilter();
    currentPage = 1;
    if (document.body.classList.contains('browse-mode-organisers')) {
      if (window.hubApplyOrganiserFilters) window.hubApplyOrganiserFilters();
      return;
    }
    if (window.hubRestoreEventFilterPrefs) {
      window.hubRestoreEventFilterPrefs();
    } else if (window.hubApplyFilters) {
      window.hubApplyFilters();
    } else {
      renderAll();
    }
  }

  function refreshAfterGeocode() {
    var geo = window.hubEnrichEventCoords
      ? window.hubEnrichEventCoords(events)
      : Promise.resolve();
    return geo
      .then(function () {
        if (window.hubApplyFilters) window.hubApplyFilters();
        else renderAll();
      })
      .catch(function () {
        /* map coords are optional */
      });
  }

  async function fetchEventsPayload() {
    var lastError = null;
    for (var i = 0; i < API_PATHS.length; i++) {
      var path = API_PATHS[i];
      try {
        var res = await fetch(path, { credentials: 'same-origin' });
        if (!res.ok) {
          lastError = new Error('HTTP ' + res.status + ' for ' + path);
          continue;
        }
        return await res.json();
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error('Failed to fetch');
  }

  async function load() {
    const fetchAndRender = async () => {
      setStatus('', false);
      var data;
      try {
        data = await fetchEventsPayload();
      } catch (e) {
        var detail = e && e.message ? String(e.message) : 'network error';
        var hint =
          window.location.protocol === 'file:'
            ? 'Open this page via your dev server: http://localhost:3000/events/ (run npm start first). Do not open the HTML file from Finder.'
            : 'Could not load events (' +
              detail +
              '). Confirm npm start is running, use http://localhost:3000/events/, and disable ad blockers for localhost.';
        setStatus(hint, true);
        events = [];
        applyLoadedEvents();
        return;
      }

      try {
        const provider = data.provider || 'supabase';

        if (!data.configured) {
          setStatus(
            'Connect Supabase: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel, then redeploy.',
            true
          );
          events = [];
        } else if (data.error) {
          setStatus('Could not load events: ' + (data.detail || data.message || data.error), true);
          events = [];
        } else {
          events = data.events || [];
          setStatus(
            events.length
              ? ''
              : 'No published events yet. Approve events in Supabase so they appear in published_events.',
            false
          );
        }
        applyLoadedEvents();
      } catch (e) {
        console.error('Events render error', e);
      }

      try {
        await refreshAfterGeocode();
      } catch (e) {
        /* map coords are optional */
      }
    };

    if (window.FactLoader) {
      await window.FactLoader.run(fetchAndRender);
      return;
    }

    setLoading(true);
    var safetyTimer = setTimeout(function () {
      setLoading(false);
    }, 6000);
    try {
      await fetchAndRender();
    } finally {
      clearTimeout(safetyTimer);
      setLoading(false);
    }
  }

  window.hubReloadEvents = load;
  window.hubEventDetailHref = detailHref;
  window.hubSpotlightStep = advanceSpotlight;
  initListingsPagination();
  load();
})();
