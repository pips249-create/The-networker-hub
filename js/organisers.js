/**
 * Organiser browse — card grid on events page (organiser mode).
 */
(function () {
  var API = '/api/organisers';
  var PAGE_SIZE = 12;

  var els = {
    listings: document.getElementById('event-listings'),
    resultsCount: document.getElementById('results-count'),
    countAll: document.getElementById('org-count-all'),
    countFeatured: document.getElementById('org-count-featured'),
  };

  var organisers = [];
  var currentPage = 1;
  var SPOTLIGHT_MAX = 12;
  var SPOTLIGHT_AUTO_MS = 2800;
  var spotlightFeaturedOrder = null;
  var spotlightTimer = null;
  var spotlightAnimating = false;
  var spotlightCarouselBound = false;
  var spotlightViewAllBound = false;

  var META_PIN_SVG =
    '<svg class="premium-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';
  var META_STAR_SVG =
    '<svg class="premium-meta-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.7 7-6.3-3.8-6.3 3.8 1.7-7-5.4-4.7 7.1-.6z"/></svg>';

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function starsHtml(rating) {
    var avg = Number(rating);
    var full =
      Number.isFinite(avg) && avg > 0 ? Math.min(5, Math.max(0, Math.round(avg))) : 0;
    var html = '';
    for (var i = 1; i <= 5; i++) {
      html +=
        '<span class="star ' +
        (i <= full ? 'is-full' : '') +
        '" aria-hidden="true">★</span>';
    }
    return html;
  }

  function organiserHref(org) {
    if (window.HubPublicUrls && window.HubPublicUrls.organiserDetailHref) {
      return window.HubPublicUrls.organiserDetailHref(org);
    }
    var slug = org && org.slug ? String(org.slug).trim() : '';
    if (slug) return '/organisers/' + encodeURIComponent(slug);
    if (org && org.id) return '/events/organiser?id=' + encodeURIComponent(org.id);
    return '/events/#organisers';
  }

  function logoHtml(org) {
    var url = org.photoUrl || '';
    var letter = String(org.name || '?').trim().charAt(0).toUpperCase() || '?';
    if (url) {
      return (
        '<img class="organiser-card-logo" src="' +
        escapeHtml(url) +
        '" alt="' +
        escapeHtml(org.name || 'Organiser logo') +
        '" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.parentElement.innerHTML=\'<span class=organiser-card-logo-placeholder>' +
        escapeHtml(letter) +
        '</span>\'">'
      );
    }
    return '<span class="organiser-card-logo-placeholder" aria-hidden="true">' + escapeHtml(letter) + '</span>';
  }

  function listingCountLabel(n) {
    var count = Number(n) || 0;
    if (count === 0) return 'No listings yet';
    return count === 1 ? '1 listing' : count + ' listings';
  }

  function shuffleList(list) {
    var copy = list.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function resetSpotlightOrder() {
    spotlightFeaturedOrder = null;
  }

  function stopSpotlightAuto() {
    if (spotlightTimer) {
      clearInterval(spotlightTimer);
      spotlightTimer = null;
    }
  }

  function getSpotlightTrack() {
    return document.getElementById('org-spotlight-track');
  }

  function getSpotlightFeatured() {
    var source = window.hubAllOrganisers && window.hubAllOrganisers.length ? window.hubAllOrganisers : organisers;
    if (!spotlightFeaturedOrder) {
      spotlightFeaturedOrder = shuffleList(
        source
          .filter(function (o) {
            return o.featured;
          })
          .slice(0, SPOTLIGHT_MAX)
      );
    }
    return spotlightFeaturedOrder;
  }

  function getSpotlightCardStep() {
    var track = getSpotlightTrack();
    if (!track) return 274;
    var card = track.querySelector('.premium-card');
    if (!card) return 274;
    var gap = parseFloat(getComputedStyle(track).gap) || 14;
    return card.getBoundingClientRect().width + gap;
  }

  function measureSpotlightLoopWidth() {
    var sc = window.HubSpotlightCarousel;
    var track = getSpotlightTrack();
    var featured = getSpotlightFeatured();
    if (!sc || !track || !featured.length) return 0;
    return sc.measureLoopWidth(track, featured.length, '.premium-card');
  }

  function syncSpotlightLoopScroll() {
    var sc = window.HubSpotlightCarousel;
    var track = getSpotlightTrack();
    if (!sc || !track) return;
    var loopWidth = measureSpotlightLoopWidth();
    sc.syncLoopScroll(track, loopWidth);
  }

  function layoutSpotlightTrack(cardsHtml, itemCount) {
    var sc = window.HubSpotlightCarousel;
    var track = getSpotlightTrack();
    if (!sc || !track) return;
    var section = track.closest('.premium-spotlight');
    sc.applyLoopLayout(track, section, itemCount, '.premium-card', cardsHtml);
  }

  function refreshSpotlightLayout() {
    var featured = getSpotlightFeatured();
    var track = getSpotlightTrack();
    if (!track || !featured.length) return;
    layoutSpotlightTrack(featured.map(premiumSpotlightCard).join(''), featured.length);
    syncSpotlightLoopScroll();
    startSpotlightAuto();
  }

  function startSpotlightAuto() {
    stopSpotlightAuto();
    var track = getSpotlightTrack();
    var sc = window.HubSpotlightCarousel;
    if (!track || !sc || !sc.canAutoAdvance(track, getSpotlightFeatured().length)) return;
    spotlightTimer = window.setInterval(function () {
      if (document.hidden || spotlightAnimating) return;
      advanceSpotlight(1);
    }, SPOTLIGHT_AUTO_MS);
  }

  function advanceSpotlight(dir) {
    dir = dir < 0 ? -1 : 1;
    var featured = getSpotlightFeatured();
    var track = getSpotlightTrack();
    var sc = window.HubSpotlightCarousel;
    if (!featured.length || featured.length <= 1 || !track || spotlightAnimating) return;

    spotlightAnimating = true;
    stopSpotlightAuto();

    var step = getSpotlightCardStep() * dir;
    var looping = sc && sc.isLooping(track);
    var loopWidth =
      looping && sc
        ? parseFloat(track.dataset.loopWidth) || sc.measureLoopWidth(track, featured.length, '.premium-card')
        : 0;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var behavior = reduceMotion ? 'auto' : 'smooth';

    function finishAdvance() {
      syncSpotlightLoopScroll();
      spotlightAnimating = false;
      startSpotlightAuto();
    }

    if (looping && loopWidth > 0) {
      if (dir < 0 && track.scrollLeft <= 4) {
        track.scrollLeft = loopWidth;
      }
      track.scrollBy({ left: step, behavior: behavior });
    } else if (sc) {
      sc.advanceNonLoop(track, dir, step, behavior);
    } else {
      track.scrollBy({ left: step, behavior: behavior });
    }

    window.setTimeout(finishAdvance, reduceMotion ? 0 : 380);
  }

  function bindSpotlightCarousel() {
    if (spotlightCarouselBound) return;
    spotlightCarouselBound = true;

    var section = document.querySelector('.org-premium-spotlight');
    var wrap = section && section.querySelector('.spotlight-wrap');
    var prev = document.getElementById('org-spotlight-prev');
    var next = document.getElementById('org-spotlight-next');

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
        if (!spotlightAnimating) refreshSpotlightLayout();
      }, 200);
    });
  }

  function bindSpotlightViewAll() {
    if (spotlightViewAllBound) return;
    spotlightViewAllBound = true;
    var link = document.getElementById('org-spotlight-view-all');
    if (!link) return;
    link.addEventListener('click', function (e) {
      e.preventDefault();
      var tab = document.querySelector('.org-type-tab[data-org-tab="featured"]');
      if (tab) tab.click();
      var block = document.getElementById('listings-view');
      if (block) block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  function spotlightLogoHtml(org) {
    var url = org.photoUrl || '';
    var letter = String(org.name || '?').trim().charAt(0).toUpperCase() || '?';
    if (url) {
      return (
        '<img class="org-premium-logo" src="' +
        escapeHtml(url) +
        '" alt="' +
        escapeHtml(org.name || 'Organiser logo') +
        '" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.outerHTML=\'<span class=org-premium-logo-placeholder aria-hidden=true>' +
        escapeHtml(letter) +
        '</span>\'">'
      );
    }
    return '<span class="org-premium-logo-placeholder" aria-hidden="true">' + escapeHtml(letter) + '</span>';
  }

  function ratingMetaLabel(org) {
    var rating = Number(org.rating) || 0;
    var reviews = Number(org.reviews) || 0;
    if (reviews > 0 && rating > 0) return rating.toFixed(1) + ' · ' + reviews + ' reviews';
    if (reviews > 0) return reviews + ' reviews';
    return 'New on the hub';
  }

  function premiumSpotlightCard(org) {
    var industry = org.industry || (org.industries && org.industries[0]) || 'Networking';
    var desc = String(org.description || '').trim();
    if (desc.length > 72) desc = desc.slice(0, 69) + '…';

    return (
      '<article class="premium-card org-premium-card" data-id="' +
      escapeHtml(org.id) +
      '">' +
      '<a class="premium-card-link" href="' +
      escapeHtml(organiserHref(org)) +
      '">' +
      '<div class="premium-card-media" aria-hidden="true">' +
      '<div class="premium-card-bg">' +
      spotlightLogoHtml(org) +
      '</div>' +
      '<div class="premium-card-overlay"></div></div>' +
      '<div class="premium-card-top">' +
      '<span class="premium-badge">Premium</span>' +
      '<span class="premium-price">' +
      escapeHtml(listingCountLabel(org.eventCount)) +
      '</span></div>' +
      '<div class="premium-card-body">' +
      '<span class="org-premium-industry">' +
      escapeHtml(industry) +
      '</span>' +
      '<h3 class="premium-card-title">' +
      escapeHtml(org.name) +
      '</h3>' +
      '<div class="premium-card-meta">' +
      '<p class="premium-meta-row">' +
      META_PIN_SVG +
      '<span>' +
      escapeHtml(industry) +
      '</span></p>' +
      '<p class="premium-meta-row">' +
      META_STAR_SVG +
      '<span>' +
      escapeHtml(ratingMetaLabel(org)) +
      '</span></p>' +
      (desc
        ? '<p class="premium-meta-row premium-meta-row--muted"><span>' + escapeHtml(desc) + '</span></p>'
        : '') +
      '</div></div></a></article>'
    );
  }

  function renderSpotlight() {
    if (!document.body.classList.contains('browse-mode-organisers')) return;

    var track = getSpotlightTrack();
    var promo = document.getElementById('organisers-promo-section');
    if (!track) return;

    bindSpotlightViewAll();

    var featured = getSpotlightFeatured();
    if (!featured.length) {
      track.innerHTML =
        '<p class="spotlight-empty">No featured organisers yet — mark organiser pages as <strong>featured</strong> in Command Centre (up to ' +
        SPOTLIGHT_MAX +
        ').</p>';
      track.classList.remove('spotlight-track--carousel');
      track.removeAttribute('data-loop-width');
      track.scrollLeft = 0;
      stopSpotlightAuto();
      if (promo) promo.hidden = false;
      return;
    }

    var cardsHtml = featured.map(premiumSpotlightCard).join('');
    track.classList.add('spotlight-track--carousel');
    if (promo) promo.hidden = false;
    bindSpotlightCarousel();
    requestAnimationFrame(function () {
      layoutSpotlightTrack(cardsHtml, featured.length);
      syncSpotlightLoopScroll();
      startSpotlightAuto();
    });
  }

  function gridCard(org) {
    var industry = org.industry || (org.industries && org.industries[0]) || 'Networking';
    var desc = String(org.description || '').trim();
    if (desc.length > 160) desc = desc.slice(0, 157) + '…';
    var reviewCount = Number(org.reviews) || 0;

    return (
      '<article class="organiser-grid-card" data-id="' +
      escapeHtml(org.id) +
      '">' +
      '<div class="organiser-card-header">' +
      '<span class="organiser-card-industry">' +
      escapeHtml(industry) +
      '</span>' +
      '<span class="organiser-card-count">' +
      escapeHtml(listingCountLabel(org.eventCount)) +
      '</span>' +
      '<div class="organiser-card-logo-wrap">' +
      logoHtml(org) +
      '</div></div>' +
      '<div class="organiser-card-body">' +
      '<span class="organiser-card-label">Organiser</span>' +
      '<h3 class="organiser-card-name">' +
      escapeHtml(org.name) +
      '</h3>' +
      (org.ranking && org.ranking.label
        ? '<span class="organiser-card-ranking hub-ranking-badge hub-ranking-badge--' +
          escapeHtml(org.ranking.tier || 'top10') +
          '" title="Ranked #' +
          escapeHtml(String(org.ranking.rank)) +
          ' of ' +
          escapeHtml(String(org.ranking.totalRanked)) +
          '">★ ' +
          escapeHtml(
            org.ranking.cardLabel ||
              org.ranking.displayLabel ||
              String(org.ranking.label).replace(' on the Hub', '')
          ) +
          '</span>'
        : '') +
      '<p class="organiser-card-desc">' +
      escapeHtml(desc || (Number(org.eventCount) ? 'Networking group on The Networker Hub.' : 'Profile coming soon — no listings yet.')) +
      '</p>' +
      '<div class="organiser-card-rating">' +
      '<span class="stars">' +
      starsHtml(org.rating) +
      '</span>' +
      '<span class="review-count">(' +
      reviewCount +
      ')</span>' +
      '<button type="button" class="fav-btn" data-organiser-id="' +
      escapeHtml(org.id) +
      '" aria-label="Save organiser" aria-pressed="false">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>' +
      '</button></div>' +
      '<div class="organiser-card-footer">' +
      '<a class="organiser-card-cta" href="' +
      escapeHtml(organiserHref(org)) +
      '">More info</a></div></div></article>'
    );
  }

  function paginationHtml(page, totalPages) {
    if (totalPages <= 1) return '';
    var items = [];
    var maxVisible = 5;
    var start = Math.max(1, page - 2);
    var end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);

    items.push(
      '<button type="button" class="page-btn page-prev" data-page="' +
        (page - 1) +
        '" ' +
        (page <= 1 ? 'disabled' : '') +
        ' aria-label="Previous page">‹</button>'
    );

    if (start > 1) {
      items.push('<button type="button" class="page-btn" data-page="1">1</button>');
      if (start > 2) items.push('<span class="page-ellipsis" aria-hidden="true">…</span>');
    }

    for (var p = start; p <= end; p++) {
      items.push(
        '<button type="button" class="page-btn' +
          (p === page ? ' is-active' : '') +
          '" data-page="' +
          p +
          '" ' +
          (p === page ? 'aria-current="page"' : '') +
          '>' +
          p +
          '</button>'
      );
    }

    if (end < totalPages) {
      if (end < totalPages - 1) items.push('<span class="page-ellipsis" aria-hidden="true">…</span>');
      items.push(
        '<button type="button" class="page-btn" data-page="' + totalPages + '">' + totalPages + '</button>'
      );
    }

    items.push(
      '<button type="button" class="page-btn page-next" data-page="' +
        (page + 1) +
        '" ' +
        (page >= totalPages ? 'disabled' : '') +
        ' aria-label="Next page">›</button>'
    );

    return '<nav class="listings-pagination" aria-label="Organiser pages">' + items.join('') + '</nav>';
  }

  function getFilteredList() {
    return window.hubGetFilteredOrganisers
      ? window.hubGetFilteredOrganisers(organisers)
      : organisers.slice();
  }

  function updateCounts() {
    var all = window.hubAllOrganisers || organisers;
    if (window.hubGetFilteredOrganisers) {
      var allList = window.hubGetFilteredOrganisers(all, { tab: 'all' });
      var featured = window.hubGetFilteredOrganisers(all, { tab: 'featured' });
      if (els.countAll) els.countAll.textContent = '(' + allList.length + ')';
      if (els.countFeatured) els.countFeatured.textContent = '(' + featured.length + ')';
      return;
    }
    if (els.countAll) els.countAll.textContent = '(' + all.length + ')';
    if (els.countFeatured) {
      var f = all.filter(function (o) {
        return o.featured;
      }).length;
      els.countFeatured.textContent = '(' + f + ')';
    }
  }

  function renderGridPage(list) {
    var rows = list;
    var totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    var start = (currentPage - 1) * PAGE_SIZE;
    var pageItems = rows.slice(start, start + PAGE_SIZE);

    if (!els.listings) return;

    if (!rows.length) {
      els.listings.innerHTML =
        '<div class="empty-state is-visible" role="status">' +
        '<div class="empty-state-inner">' +
        '<h3 class="empty-state-title">No organisers match your filters</h3>' +
        '<p class="empty-state-text">Try clearing filters or searching for a different networking group.</p>' +
        '<button type="button" class="empty-state-btn" id="empty-reset">Clear all filters</button>' +
        '</div></div>';
      if (els.resultsCount) els.resultsCount.textContent = '0';
      return;
    }

    var rangeStart = start + 1;
    var rangeEnd = Math.min(start + PAGE_SIZE, rows.length);
    var rangeHtml =
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
      '<div class="organiser-grid">' +
      pageItems.map(gridCard).join('') +
      '</div>' +
      paginationHtml(currentPage, totalPages);

    if (els.resultsCount) els.resultsCount.textContent = String(rows.length);
    if (window.HubOrganiserFavourites) window.HubOrganiserFavourites.refreshButtons(els.listings);
  }

  function renderAll() {
    renderSpotlight();
    var filtered = getFilteredList();
    renderGridPage(filtered);
    updateCounts();
  }

  window.hubRefreshOrganiserListings = function () {
    currentPage = 1;
    renderAll();
  };

  window.hubRenderOrganisers = function () {
    renderAll();
  };

  function initPagination() {
    if (!els.listings || els.listings.dataset.orgPaginationBound) return;
    els.listings.dataset.orgPaginationBound = '1';
    els.listings.addEventListener('click', function (e) {
      var btn = e.target.closest('.page-btn');
      if (!btn || btn.disabled) return;
      var filtered = getFilteredList();
      var totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
      var p = parseInt(btn.getAttribute('data-page'), 10);
      if (!p || p === currentPage || p < 1 || p > totalPages) return;
      currentPage = p;
      renderGridPage(filtered);
    });
  }

  function setLoading(on) {
    if (window.FactLoader) return;
    const shell = document.getElementById('events-shell');
    if (shell) shell.classList.toggle('is-loading', !!on);
  }

  function applyLoadedOrganisers() {
    window.hubAllOrganisers = organisers;
    resetSpotlightOrder();
    if (window.hubResetOrganiserBrowseOrder) window.hubResetOrganiserBrowseOrder();
    currentPage = 1;
    if (window.hubApplyOrganiserFilters) window.hubApplyOrganiserFilters();
    else renderAll();
  }

  var loadPromise = null;

  function loadOrganisers() {
    if (loadPromise) return loadPromise;
    if (organisers.length) {
      applyLoadedOrganisers();
      return Promise.resolve(organisers);
    }

    const fetchOrganisers = function () {
      return fetch(API)
        .then(function (res) {
          return res.json();
        })
        .then(function (data) {
          if (!data.configured) {
            organisers = [];
          } else if (data.error) {
            organisers = [];
          } else {
            organisers = data.organisers || [];
          }
          applyLoadedOrganisers();
          return organisers;
        })
        .catch(function () {
          organisers = [];
          applyLoadedOrganisers();
          return organisers;
        })
        .finally(function () {
          loadPromise = null;
        });
    };

    if (window.FactLoader) {
      loadPromise = window.FactLoader.run(fetchOrganisers);
      return loadPromise;
    }

    setLoading(true);
    loadPromise = fetchOrganisers().finally(function () {
      setLoading(false);
    });
    return loadPromise;
  }

  window.hubLoadOrganisers = loadOrganisers;
  window.hubRenderOrganiserSpotlight = renderSpotlight;
  window.hubStopOrganiserSpotlight = stopSpotlightAuto;
  initPagination();
})();
