/**
 * Opportunities — browse page with sidebar filters, tabs, sort & pagination.
 */
(function () {
  var PAGE_SIZE = 36;
  var SEARCH_DEBOUNCE_MS = 200;
  var SPOTLIGHT_MAX = 10;
  var SPOTLIGHT_AUTO_MS = 2800;

  var META_PIN_SVG =
    '<svg class="premium-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';
  var META_HOST_SVG =
    '<svg class="premium-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

  var catalog = window.HubOpportunitiesCatalog;
  var saves = window.HubOpportunitySaves;

  var FAV_ICON =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>' +
    '</svg>';

  var TAB_TYPES = [
    'all',
    'franchise',
    'side-hustle',
    'partnership',
    'networking',
    'distributorship',
    'business-opportunity',
  ];

  var allListings = [];
  var activeType = 'all';
  var activeCategory = '';
  var sidebarFilters = [];
  var searchQ = '';
  var sortBy = 'recommended';
  var viewMode = 'grid';
  var minInvest = null;
  var maxInvest = null;
  var currentPage = 1;
  var searchTimer = null;
  var rangeTimer = null;
  var spotlightFeaturedOrder = null;
  var spotlightTimer = null;
  var spotlightAnimating = false;
  var spotlightCarouselBound = false;

  var els = {};

  function cacheEls() {
    els.mount = document.getElementById('opp-listings-mount');
    els.resultsCount = document.getElementById('opp-results-count');
    els.stripFilters = document.getElementById('opp-strip-filters');
    els.search = document.getElementById('opp-search');
    els.sort = document.getElementById('opp-sort');
    els.sidebar = document.querySelector('.opp-sidebar');
    els.catPills = document.getElementById('opp-cat-pills');
    els.viewGrid = document.getElementById('opp-view-grid');
    els.viewList = document.getElementById('opp-view-list');
    els.minInvest = document.getElementById('opp-min-invest');
    els.maxInvest = document.getElementById('opp-max-invest');
    els.sidebarClear = document.getElementById('opp-sidebar-clear');
    els.spotlightTrack = document.getElementById('opp-spotlight-track');
    els.spotlightSection = document.querySelector('.opp-premium-spotlight');
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

  function getSpotlightFeatured() {
    if (!spotlightFeaturedOrder) {
      var featured = allListings
        .filter(function (item) {
          return item.featured;
        })
        .slice(0, SPOTLIGHT_MAX);
      spotlightFeaturedOrder = shuffleList(featured);
    }
    return spotlightFeaturedOrder;
  }

  function getSpotlightCardStep() {
    var track = els.spotlightTrack;
    if (!track) return 274;
    var card = track.querySelector('.opp-premium-card');
    if (!card) return 274;
    var gap = parseFloat(getComputedStyle(track).gap) || 14;
    return card.getBoundingClientRect().width + gap;
  }

  function measureSpotlightLoopWidth() {
    var track = els.spotlightTrack;
    var featured = getSpotlightFeatured();
    if (!track || !featured.length) return 0;

    var cards = track.querySelectorAll('.opp-premium-card');
    if (!cards.length) return 0;

    var gap = parseFloat(getComputedStyle(track).gap) || 14;
    var width = 0;
    var count = Math.min(featured.length, cards.length);

    for (var i = 0; i < count; i++) {
      width += cards[i].getBoundingClientRect().width;
      if (i < count - 1) width += gap;
    }

    return width;
  }

  function syncSpotlightLoopScroll() {
    var track = els.spotlightTrack;
    if (!track) return;
    var loopWidth = measureSpotlightLoopWidth();
    if (!loopWidth) return;

    track.dataset.loopWidth = String(loopWidth);

    if (track.scrollLeft >= loopWidth) {
      track.scrollLeft = track.scrollLeft - loopWidth;
    }
  }

  function advanceSpotlight(dir) {
    dir = dir < 0 ? -1 : 1;
    var featured = getSpotlightFeatured();
    var track = els.spotlightTrack;
    if (!featured.length || featured.length <= 1 || !track || spotlightAnimating) return;

    spotlightAnimating = true;
    stopSpotlightAuto();

    var step = getSpotlightCardStep() * dir;
    var loopWidth = parseFloat(track.dataset.loopWidth) || measureSpotlightLoopWidth();
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var behavior = reduceMotion ? 'auto' : 'smooth';

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

  function startSpotlightAuto() {
    stopSpotlightAuto();
    if (!els.spotlightTrack) return;
    if (getSpotlightFeatured().length <= 1) return;
    spotlightTimer = window.setInterval(function () {
      if (document.hidden || spotlightAnimating) return;
      advanceSpotlight(1);
    }, SPOTLIGHT_AUTO_MS);
  }

  function bindSpotlightCarousel() {
    if (spotlightCarouselBound) return;
    spotlightCarouselBound = true;

    var wrap = els.spotlightSection && els.spotlightSection.querySelector('.spotlight-wrap');
    var prev = document.getElementById('opp-spotlight-prev');
    var next = document.getElementById('opp-spotlight-next');

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
        if (!spotlightAnimating) syncSpotlightLoopScroll();
      }, 200);
    });
  }

  function spotlightInvestmentLabel(item) {
    var meta = catalog ? catalog.cardDisplayMeta(item) : (item.meta || []).slice(0, 1);
    if (meta.length && meta[0].val) return meta[0].val;
    return 'Enquire';
  }

  function premiumSpotlightCard(item) {
    var href = detailHref(item);
    var thumb = item.thumb || { emoji: '✦', gradient: 'linear-gradient(135deg,#fdf6e3,#f5e0a0)' };
    var typeLabels = catalog ? catalog.TYPE_LABELS : {};
    var typeClassFn = catalog
      ? catalog.typeClass.bind(catalog)
      : function () {
          return 'opp-type-franchise';
        };

    return (
      '<article class="premium-card opp-premium-card" data-id="' +
      escapeHtml(item.id) +
      '">' +
      '<a class="premium-card-link" href="' +
      escapeHtml(href) +
      '">' +
      '<div class="premium-card-media" aria-hidden="true">' +
      '<div class="premium-card-bg" style="background:' +
      escapeHtml(thumb.gradient) +
      '">' +
      '<span class="opp-premium-thumb-emoji" aria-hidden="true">' +
      thumb.emoji +
      '</span></div>' +
      '<div class="premium-card-overlay"></div></div>' +
      '<div class="premium-card-top">' +
      '<span class="premium-badge">Premium</span>' +
      '<span class="premium-price">' +
      escapeHtml(spotlightInvestmentLabel(item)) +
      '</span></div>' +
      '<div class="premium-card-body">' +
      '<span class="opp-premium-type ' +
      typeClassFn(item.type) +
      '">' +
      escapeHtml(typeLabels[item.type] || item.type) +
      '</span>' +
      '<h3 class="premium-card-title">' +
      escapeHtml(item.title) +
      '</h3>' +
      '<div class="premium-card-meta">' +
      '<p class="premium-meta-row">' +
      META_PIN_SVG +
      '<span>' +
      escapeHtml(item.locationLabel || 'UK') +
      '</span></p>' +
      '<p class="premium-meta-row">' +
      META_HOST_SVG +
      '<span>' +
      escapeHtml(item.host || 'Listed on The Networker') +
      '</span></p>' +
      '</div></div></a></article>'
    );
  }

  function renderSpotlight() {
    if (!els.spotlightTrack) return;

    var featured = getSpotlightFeatured();
    var promo = document.querySelector('.opp-promo-section');

    if (!featured.length) {
      els.spotlightTrack.innerHTML =
        '<p class="spotlight-empty">No featured opportunities yet — mark listings as <strong>featured</strong> in Command Centre (up to ' +
        SPOTLIGHT_MAX +
        ').</p>';
      els.spotlightTrack.classList.remove('spotlight-track--carousel');
      els.spotlightTrack.removeAttribute('data-loop-width');
      els.spotlightTrack.scrollLeft = 0;
      stopSpotlightAuto();
      if (promo) promo.hidden = false;
      return;
    }

    var cardsHtml = featured.map(premiumSpotlightCard).join('');
    var loopHtml = featured.length > 1 ? cardsHtml : '';
    els.spotlightTrack.innerHTML = cardsHtml + loopHtml;
    els.spotlightTrack.classList.add('spotlight-track--carousel');
    els.spotlightTrack.scrollLeft = 0;
    if (promo) promo.hidden = false;
    bindSpotlightCarousel();
    requestAnimationFrame(function () {
      syncSpotlightLoopScroll();
      startSpotlightAuto();
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function detailHref(item) {
    return catalog ? catalog.detailHref(item) : 'opportunity.html?id=' + encodeURIComponent(item.id);
  }

  function hasTag(item, tag) {
    var tags = (item.filterTags || []).concat(item.tags || []);
    return tags.indexOf(tag) !== -1;
  }

  function matchesSidebar(item) {
    if (!sidebarFilters.length && minInvest === null && maxInvest === null) return true;

    if (sidebarFilters.length && !sidebarFilters.some(function (f) {
      return hasTag(item, f);
    })) {
      return false;
    }

    if (minInvest !== null && (item.investAmount === null || item.investAmount < minInvest)) return false;
    if (maxInvest !== null && (item.investAmount === null || item.investAmount > maxInvest)) return false;
    return true;
  }

  function matchesFilter(item) {
    if (activeType !== 'all' && item.type !== activeType && !hasTag(item, activeType)) return false;
    if (activeCategory && item.category !== activeCategory) return false;
    if (!matchesSidebar(item)) return false;
    if (searchQ && item.searchText.indexOf(searchQ) === -1) return false;
    return true;
  }

  function getFilteredList() {
    return allListings.filter(matchesFilter);
  }

  function sortListings(list) {
    var sorted = list.slice();
    sorted.sort(function (a, b) {
      if (sortBy === 'recommended') {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return a.title.localeCompare(b.title, 'en-GB');
      }
      if (sortBy === 'invest-asc') {
        return (a.investAmount || 0) - (b.investAmount || 0);
      }
      if (sortBy === 'invest-desc') {
        return (b.investAmount || 0) - (a.investAmount || 0);
      }
      if (sortBy === 'alpha') {
        return a.title.localeCompare(b.title, 'en-GB');
      }
      return 0;
    });
    return sorted;
  }

  function countBy(predicate) {
    var n = 0;
    for (var i = 0; i < allListings.length; i++) {
      if (predicate(allListings[i])) n++;
    }
    return n;
  }

  function updateListingsStat() {
    var stat = document.getElementById('opp-stat-listings');
    if (!stat) return;
    var n = allListings.length;
    stat.textContent = n >= 84 ? '84+' : String(n);
  }

  function updateFilterCounts() {
    updateListingsStat();
    document.querySelectorAll('[data-count-for]').forEach(function (el) {
      var key = el.getAttribute('data-count-for');
      var n;
      if (key === 'all') n = allListings.length;
      else if (TAB_TYPES.indexOf(key) !== -1) {
        n = countBy(function (item) {
          return key === 'all' || item.type === key || hasTag(item, key);
        });
      } else {
        n = countBy(function (item) {
          return hasTag(item, key);
        });
      }
      el.textContent = n;
    });
  }

  function metaCellHtml(m) {
    var scarcity = catalog && catalog.isScarcityMeta(m.key, m.val);
    return (
      '<div class="opp-meta-cell' +
      (scarcity ? ' opp-meta-cell--scarcity' : '') +
      '"><span class="opp-meta-k">' +
      escapeHtml(m.key) +
      '</span><span class="opp-meta-v">' +
      escapeHtml(m.val) +
      '</span></div>'
    );
  }

  function cardHtml(item) {
    var href = detailHref(item);
    var typeLabels = catalog ? catalog.TYPE_LABELS : {};
    var typeClassFn = catalog ? catalog.typeClass.bind(catalog) : function () {
      return 'opp-type-franchise';
    };
    var displayMeta = catalog ? catalog.cardDisplayMeta(item) : (item.meta || []).slice(0, 4);
    var thumb = item.thumb || { emoji: '✦', gradient: 'linear-gradient(135deg,#fdf6e3,#f5e0a0)' };
    var locIcon = /remote/i.test(item.locationLabel || '') ? '🌐' : '📍';

    while (displayMeta.length < 4) {
      displayMeta.push({ key: '\u00a0', val: '—' });
    }

    return (
      '<article class="opp-card' +
      (item.featured ? ' featured' : '') +
      '" data-type="' +
      escapeHtml(item.type) +
      '">' +
      '<button type="button" class="opp-fav-btn' +
      (saves && saves.isSaved(item.id) ? ' is-active' : '') +
      '" data-opp-id="' +
      escapeHtml(item.id) +
      '" aria-label="' +
      (saves && saves.isSaved(item.id) ? 'Remove from saved' : 'Save opportunity') +
      '" aria-pressed="' +
      (saves && saves.isSaved(item.id) ? 'true' : 'false') +
      '">' +
      FAV_ICON +
      '</button>' +
      '<div class="opp-thumb" style="background:' +
      escapeHtml(thumb.gradient) +
      '">' +
      '<span class="opp-type-tag ' +
      typeClassFn(item.type) +
      '">' +
      escapeHtml(typeLabels[item.type] || item.type) +
      '</span>' +
      (item.featured ? '<span class="opp-feat-pip">Featured</span>' : '') +
      '<span class="opp-thumb-emoji" aria-hidden="true">' +
      thumb.emoji +
      '</span>' +
      '</div>' +
      '<div class="opp-card-body">' +
      '<div class="opp-company">' +
      '<div class="opp-co-avatar" style="background:' +
      escapeHtml(item.hostColor) +
      '" aria-hidden="true">' +
      escapeHtml(item.hostInitials) +
      '</div>' +
      '<span class="opp-co-name">' +
      escapeHtml(item.host) +
      '</span></div>' +
      '<h3 class="opp-card-title"><a href="' +
      escapeHtml(href) +
      '">' +
      escapeHtml(item.title) +
      '</a></h3>' +
      '<p class="opp-card-desc">' +
      escapeHtml(item.desc) +
      '</p>' +
      '<div class="opp-meta-row">' +
      displayMeta.map(metaCellHtml).join('') +
      '</div>' +
      '</div>' +
      '<div class="opp-card-footer">' +
      '<span class="opp-location">' +
      locIcon +
      ' ' +
      escapeHtml(item.locationLabel || 'UK') +
      '</span>' +
      '<a href="' +
      escapeHtml(href) +
      '" class="opp-enquire-btn">Enquire →</a>' +
      '</div>' +
      '</article>'
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
      '<button type="button" class="opp-page-btn opp-page-prev" data-page="' +
        (page - 1) +
        '"' +
        (page <= 1 ? ' disabled' : '') +
        ' aria-label="Previous page">‹</button>'
    );

    if (start > 1) {
      items.push('<button type="button" class="opp-page-btn" data-page="1">1</button>');
      if (start > 2) items.push('<span class="opp-page-ellipsis" aria-hidden="true">…</span>');
    }

    for (var p = start; p <= end; p++) {
      items.push(
        '<button type="button" class="opp-page-btn' +
          (p === page ? ' is-active' : '') +
          '" data-page="' +
          p +
          '"' +
          (p === page ? ' aria-current="page"' : '') +
          '>' +
          p +
          '</button>'
      );
    }

    if (end < totalPages) {
      if (end < totalPages - 1) items.push('<span class="opp-page-ellipsis" aria-hidden="true">…</span>');
      items.push('<button type="button" class="opp-page-btn" data-page="' + totalPages + '">' + totalPages + '</button>');
    }

    items.push(
      '<button type="button" class="opp-page-btn opp-page-next" data-page="' +
        (page + 1) +
        '"' +
        (page >= totalPages ? ' disabled' : '') +
        ' aria-label="Next page">›</button>'
    );

    return '<nav class="opp-pagination" aria-label="Opportunity pages">' + items.join('') + '</nav>';
  }

  function updateResultsCount(shown, total, rangeStart, rangeEnd) {
    if (!els.resultsCount) return;
    if (!total) {
      els.resultsCount.innerHTML = 'No listings match your filters';
      return;
    }
    if (total <= PAGE_SIZE) {
      els.resultsCount.innerHTML =
        'Showing <strong>' + shown + '</strong> of <strong>' + total + '</strong> opportunities';
      return;
    }
    els.resultsCount.innerHTML =
      'Showing <strong>' +
      rangeStart +
      '–' +
      rangeEnd +
      '</strong> of <strong>' +
      total +
      '</strong> opportunities';
  }

  function syncTabUI() {
    if (!els.stripFilters) return;
    els.stripFilters.querySelectorAll('.opp-tab-btn').forEach(function (btn) {
      var on = btn.getAttribute('data-filter') === activeType;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  function syncCatPills() {
    if (!els.catPills) return;
    els.catPills.querySelectorAll('.opp-cat-pill').forEach(function (pill) {
      pill.classList.toggle('active', pill.getAttribute('data-cat') === activeCategory);
    });
  }

  function renderListings() {
    if (!els.mount) return;

    var filtered = sortListings(getFilteredList());
    var totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    var start = (currentPage - 1) * PAGE_SIZE;
    var pageItems = filtered.slice(start, start + PAGE_SIZE);

    if (!filtered.length) {
      els.mount.innerHTML =
        '<div class="opp-no-results is-visible" role="status">' +
        '<div class="opp-no-results-icon" aria-hidden="true">🔍</div>' +
        '<h3>No opportunities match your filters</h3>' +
        '<p>Try adjusting your search or <button type="button" class="opp-clear-btn" id="opp-clear-filters">clear all filters</button>.</p>' +
        '</div>';
      updateResultsCount(0, 0, 0, 0);
      bindClearFilters();
      return;
    }

    var rangeStart = start + 1;
    var rangeEnd = Math.min(start + PAGE_SIZE, filtered.length);
    var gridClass = 'opp-opps-grid' + (viewMode === 'list' ? ' list-view' : '');

    els.mount.innerHTML =
      '<div class="' +
      gridClass +
      '">' +
      pageItems.map(cardHtml).join('') +
      '</div>' +
      paginationHtml(currentPage, totalPages);

    updateResultsCount(pageItems.length, filtered.length, rangeStart, rangeEnd);
    if (saves) saves.refreshButtons(els.mount);
  }

  function bindClearFilters() {
    var btn = document.getElementById('opp-clear-filters');
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', resetFilters);
  }

  function readSidebarFilters() {
    sidebarFilters = [];
    if (!els.sidebar) return;
    els.sidebar.querySelectorAll('input[type="checkbox"][data-filter]:checked').forEach(function (cb) {
      sidebarFilters.push(cb.getAttribute('data-filter'));
    });
  }

  function readInvestRange() {
    minInvest = els.minInvest && els.minInvest.value !== '' ? parseInt(els.minInvest.value, 10) : null;
    maxInvest = els.maxInvest && els.maxInvest.value !== '' ? parseInt(els.maxInvest.value, 10) : null;
    if (isNaN(minInvest)) minInvest = null;
    if (isNaN(maxInvest)) maxInvest = null;
  }

  function applyFilters() {
    readSidebarFilters();
    readInvestRange();
    currentPage = 1;
    renderListings();
  }

  function setType(type) {
    activeType = type || 'all';
    syncTabUI();
    applyFilters();
  }

  function resetFilters() {
    activeType = 'all';
    activeCategory = '';
    searchQ = '';
    sortBy = 'recommended';
    sidebarFilters = [];
    minInvest = null;
    maxInvest = null;
    currentPage = 1;

    if (els.search) els.search.value = '';
    if (els.sort) els.sort.value = 'recommended';
    if (els.minInvest) els.minInvest.value = '';
    if (els.maxInvest) els.maxInvest.value = '';
    if (els.sidebar) {
      els.sidebar.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
        cb.checked = false;
      });
    }

    updateSearchClearVisibility();
    syncTabUI();
    syncCatPills();
    renderListings();
  }

  function updateSearchClearVisibility() {
    var clearBtn = document.getElementById('opp-search-clear');
    if (!clearBtn || !els.search) return;
    clearBtn.hidden = !els.search.value.trim();
  }

  function initStripTabs() {
    if (!els.stripFilters || els.stripFilters.dataset.bound) return;
    els.stripFilters.dataset.bound = '1';
    els.stripFilters.addEventListener('click', function (e) {
      var btn = e.target.closest('.opp-tab-btn');
      if (!btn) return;
      setType(btn.getAttribute('data-filter') || 'all');
    });
  }

  function initSidebar() {
    if (!els.sidebar || els.sidebar.dataset.bound) return;
    els.sidebar.dataset.bound = '1';

    els.sidebar.addEventListener('change', function (e) {
      if (e.target.matches('input[type="checkbox"][data-filter]')) applyFilters();
    });

    [els.minInvest, els.maxInvest].forEach(function (input) {
      if (!input) return;
      input.addEventListener('input', function () {
        clearTimeout(rangeTimer);
        rangeTimer = setTimeout(applyFilters, SEARCH_DEBOUNCE_MS);
      });
    });

    if (els.sidebarClear) {
      els.sidebarClear.addEventListener('click', resetFilters);
    }
  }

  function initSearch() {
    if (!els.search) return;

    els.search.addEventListener('input', function () {
      var val = els.search.value.trim().toLowerCase();
      updateSearchClearVisibility();
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        searchQ = val;
        currentPage = 1;
        renderListings();
      }, SEARCH_DEBOUNCE_MS);
    });

    var clearBtn = document.getElementById('opp-search-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        els.search.value = '';
        els.search.focus();
        searchQ = '';
        currentPage = 1;
        updateSearchClearVisibility();
        renderListings();
      });
    }
  }

  function initSort() {
    if (!els.sort || els.sort.dataset.bound) return;
    els.sort.dataset.bound = '1';
    els.sort.addEventListener('change', function () {
      sortBy = els.sort.value || 'recommended';
      currentPage = 1;
      renderListings();
    });
  }

  function initViewToggle() {
    function setView(mode) {
      viewMode = mode;
      if (els.viewGrid) {
        els.viewGrid.classList.toggle('is-active', mode === 'grid');
        els.viewGrid.setAttribute('aria-pressed', mode === 'grid' ? 'true' : 'false');
      }
      if (els.viewList) {
        els.viewList.classList.toggle('is-active', mode === 'list');
        els.viewList.setAttribute('aria-pressed', mode === 'list' ? 'true' : 'false');
      }
      renderListings();
    }

    if (els.viewGrid) els.viewGrid.addEventListener('click', function () {
      setView('grid');
    });
    if (els.viewList) els.viewList.addEventListener('click', function () {
      setView('list');
    });
  }

  function initCatPills() {
    if (!els.catPills || els.catPills.dataset.bound) return;
    els.catPills.dataset.bound = '1';

    els.catPills.addEventListener('click', function (e) {
      var pill = e.target.closest('.opp-cat-pill');
      if (!pill) return;
      var cat = pill.getAttribute('data-cat') || '';
      activeCategory = activeCategory === cat ? '' : cat;
      syncCatPills();
      currentPage = 1;
      renderListings();
    });
  }

  function initPagination() {
    if (!els.mount || els.mount.dataset.paginationBound) return;
    els.mount.dataset.paginationBound = '1';

    els.mount.addEventListener('click', function (e) {
      var fav = e.target.closest('.opp-fav-btn');
      if (fav) {
        e.preventDefault();
        e.stopPropagation();
        if (saves) saves.toggle(fav.getAttribute('data-opp-id'));
        if (saves) saves.refreshButtons(els.mount);
        return;
      }

      var btn = e.target.closest('.opp-page-btn');
      if (!btn || btn.disabled) return;
      var filtered = getFilteredList();
      var totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
      var p = parseInt(btn.getAttribute('data-page'), 10);
      if (!p || p === currentPage || p < 1 || p > totalPages) return;
      currentPage = p;
      renderListings();
      var browse = document.getElementById('browse');
      if (browse) browse.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function bootListings(listings) {
    allListings = listings || [];
    updateFilterCounts();
    syncTabUI();
    resetSpotlightOrder();
    renderSpotlight();
    renderListings();
  }

  function init() {
    cacheEls();
    allListings = catalog ? catalog.loadCatalog() : [];
    updateFilterCounts();
    initStripTabs();
    initSidebar();
    initSearch();
    initSort();
    initViewToggle();
    initCatPills();
    initPagination();
    syncTabUI();
    resetSpotlightOrder();
    renderSpotlight();
    renderListings();

    if (catalog && catalog.loadCatalogAsync) {
      catalog.loadCatalogAsync().then(function (merged) {
        if (merged && merged.length) bootListings(merged);
      });
    }
  }

  window.submitForm = function (btn) {
    btn.textContent = "✓ Submitted — we'll be in touch within 24 hours";
    btn.style.background = '#166534';
    btn.style.color = '#fff';
    btn.disabled = true;
  };
  window.resetFilters = resetFilters;

  window.hubRenderOpportunities = function (listings) {
    if (!catalog) return;
    allListings = (listings || []).map(function (item, i) {
      return catalog.normalizeListing(item, i);
    });
    updateFilterCounts();
    currentPage = 1;
    resetSpotlightOrder();
    renderSpotlight();
    renderListings();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
