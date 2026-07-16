/**
 * Opportunities — browse page with sidebar filters, tabs, sort & pagination.
 */
(function () {
  var PAGE_SIZE = 12;
  var SEARCH_DEBOUNCE_MS = 200;
  var SPOTLIGHT_MAX = 12; /* sync with api/_lib/spotlight-carousel-limits.js */
  var SPOTLIGHT_AUTO_MS = 2800;

  var META_PIN_SVG =
    '<svg class="premium-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';
  var META_HOST_SVG =
    '<svg class="premium-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

  var catalog = window.HubOpportunitiesCatalog;
  var saves = window.HubOpportunitySaves;
  var quality = window.HubOpportunityQuality;

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
  var FILTER_OPTION_LABELS = {};
  var searchQ = '';
  var sortBy = 'recommended';
  var viewMode = 'grid';
  var minInvest = null;
  var maxInvest = null;
  var currentPage = 1;
  var accumulatedCount = 0;
  var lastRenderedCount = 0;
  var visibleRangeStart = 1;
  var loadingMore = false;
  var lazyObserver = null;
  var searchTimer = null;
  var rangeTimer = null;
  var spotlightFeaturedOrder = null;
  var spotlightTimer = null;
  var spotlightAnimating = false;
  var spotlightCarouselBound = false;
  var pendingResultsScroll = false;
  var activeCitySlug = '';
  var activeCityName = '';

  var els = {};

  function syncRegionalLanding() {
    var regional = window.hubOppRegionalLanding;
    activeCitySlug = regional && regional.slug ? String(regional.slug) : '';
    activeCityName = regional && regional.cityQuery ? String(regional.cityQuery) : '';
    if (!activeCitySlug) {
      var params = new URLSearchParams(window.location.search);
      var city = String(params.get('city') || '').trim().toLowerCase();
      if (city) activeCitySlug = city;
    }
  }

  function matchesCityRegion(item) {
    if (!activeCityName) return true;
    var hay = [
      item.locationLabel,
      item.searchText,
      item.title,
      item.desc,
      (item.tags || []).join(' '),
      (item.filterTags || []).join(' '),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    var city = activeCityName.toLowerCase();
    if (hay.indexOf(city) !== -1) return true;
    if (city.indexOf('london') !== -1 && hay.indexOf('london') !== -1) return true;
    return false;
  }

  function cacheEls() {
    els.mount = document.getElementById('opp-listings-mount');
    els.resultsCount = document.getElementById('opp-results-count');
    els.stripFilters = document.getElementById('opp-strip-filters');
    els.investPills = document.getElementById('opp-invest-pills');
    els.search = document.getElementById('opp-search');
    els.sort = document.getElementById('opp-sort');
    els.sidebar = document.querySelector('.opp-sidebar');
    els.catPills = document.getElementById('opp-cat-pills');
    els.viewGrid = document.getElementById('opp-view-grid');
    els.viewList = document.getElementById('opp-view-list');
    els.viewMap = document.getElementById('opp-view-map');
    els.minInvest = document.getElementById('opp-min-invest');
    els.maxInvest = document.getElementById('opp-max-invest');
    els.filterInvest = document.getElementById('opp-filter-invest');
    els.filterLocation = document.getElementById('opp-filter-location');
    els.filterCommitment = document.getElementById('opp-filter-commitment');
    els.filterCategory = document.getElementById('opp-filter-category');
    els.sidebarClear = document.getElementById('opp-sidebar-clear');
    els.spotlightTrack = document.getElementById('opp-spotlight-track');
    els.spotlightSection = document.querySelector('.opp-premium-spotlight');
    els.saveSearchBtn = document.getElementById('opp-save-search-btn');
    els.saveSearchStatus = document.getElementById('opp-save-search-status');
    els.copyLinkBtn = document.getElementById('opp-copy-link-btn');
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
    if (meta.length && meta[0].val) {
      return formatMetaVal(meta[0].key, meta[0].val);
    }
    return 'Enquire';
  }

  function premiumSpotlightMediaHtml(item, thumb) {
    var cover = String(item.imageUrl || '').trim();
    var mediaInner = cover
      ? '<img class="opp-premium-card-img" src="' +
        escapeHtml(cover) +
        '" alt="" loading="lazy" decoding="async" />'
      : '<span class="opp-premium-thumb-emoji" aria-hidden="true">' + thumb.emoji + '</span>';

    return (
      '<div class="premium-card-media" aria-hidden="true">' +
      '<div class="premium-card-bg" style="background:' +
      escapeHtml(thumb.gradient) +
      '">' +
      mediaInner +
      '</div>' +
      '<div class="premium-card-overlay"></div></div>'
    );
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
      premiumSpotlightMediaHtml(item, thumb) +
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

  function hasAnyFeaturedOpportunities() {
    return allListings.some(function (item) {
      return item.featured;
    });
  }

  function spotlightBoostPromoCard() {
    if (window.HubOrganiserActions && window.HubOrganiserActions.spotlightBoostCardHtml) {
      return window.HubOrganiserActions.spotlightBoostCardHtml('opportunity');
    }
    return (
      '<article class="premium-card premium-card--boost-cta opp-premium-card">' +
      '<a class="premium-card-link" href="/opportunities/list">' +
      '<div class="premium-card-media" aria-hidden="true">' +
      '<div class="premium-card-bg premium-card-bg--boost">' +
      '<span class="premium-card-boost-icon" aria-hidden="true">★</span></div>' +
      '<div class="premium-card-overlay"></div></div>' +
      '<div class="premium-card-top"><span class="premium-badge">Premium</span>' +
      '<span class="premium-price">£55/mo</span></div>' +
      '<div class="premium-card-body"><h3 class="premium-card-title">Boost your listing here</h3>' +
      '<div class="premium-card-meta">' +
      '<p class="premium-meta-row"><span>Premium Spotlight on business opportunities</span></p>' +
      '<p class="premium-meta-row premium-meta-row--cta"><span>List or upgrade to premium →</span></p>' +
      '</div></div></a></article>'
    );
  }

  function bindSpotlightBoostPromo() {
    if (window.HubOrganiserActions && window.HubOrganiserActions.bindSpotlightBoost) {
      window.HubOrganiserActions.bindSpotlightBoost(els.spotlightTrack);
    }
  }

  function renderSpotlight() {
    if (!els.spotlightTrack) return;

    var featured = getSpotlightFeatured();
    var promo = document.querySelector('.opp-promo-section');

    if (!featured.length) {
      if (hasAnyFeaturedOpportunities()) {
        els.spotlightTrack.innerHTML =
          '<p class="spotlight-empty">No premium listings match your current filters. Try clearing filters or widening your search.</p>';
      } else {
        els.spotlightTrack.innerHTML = spotlightBoostPromoCard();
        bindSpotlightBoostPromo();
      }
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
    return window.HubPublicUrls
      ? window.HubPublicUrls.opportunityDetailHref(item)
      : '/opportunities/' + encodeURIComponent(item.id);
  }

  function hasTag(item, tag) {
    var tags = (item.filterTags || []).concat(item.tags || []);
    return tags.indexOf(tag) !== -1;
  }

  function sidebarSelectValue(el) {
    return el && el.value ? el.value : '';
  }

  function hasCustomInvestRange() {
    return minInvest !== null || maxInvest !== null;
  }

  function matchesSidebar(item) {
    var invest = sidebarSelectValue(els.filterInvest);
    var location = sidebarSelectValue(els.filterLocation);
    var commitment = sidebarSelectValue(els.filterCommitment);
    var hasSidebarSelect = invest || location || commitment;

    if (!hasSidebarSelect && !hasCustomInvestRange()) return true;

    if (invest && !hasTag(item, invest)) return false;
    if (location && !hasTag(item, location)) return false;
    if (commitment && !hasTag(item, commitment)) return false;

    if (minInvest !== null && (item.investAmount === null || item.investAmount < minInvest)) return false;
    if (maxInvest !== null && (item.investAmount === null || item.investAmount > maxInvest)) return false;
    return true;
  }

  function matchesFilter(item) {
    if (activeCitySlug && !matchesCityRegion(item)) return false;
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

  function rememberFilterOptionLabels() {
    if (!els.sidebar) return;
    els.sidebar.querySelectorAll('.opp-filter-select option[data-count-for], .opp-filter-select option[data-count-category]').forEach(function (opt) {
      var key = opt.getAttribute('data-count-for') || opt.getAttribute('data-count-category');
      if (key && !FILTER_OPTION_LABELS[key]) {
        FILTER_OPTION_LABELS[key] = opt.textContent.replace(/\s*\(\d+\)\s*$/, '').trim();
      }
    });
  }

  function countForFilterKey(key) {
    if (TAB_TYPES.indexOf(key) !== -1) {
      return countBy(function (item) {
        return key === 'all' || item.type === key || hasTag(item, key);
      });
    }
    return countBy(function (item) {
      return hasTag(item, key);
    });
  }

  function updateFilterCounts() {
    updateListingsStat();
    rememberFilterOptionLabels();
    document.querySelectorAll('[data-count-for], [data-count-category]').forEach(function (el) {
      var key = el.getAttribute('data-count-for');
      var categoryKey = el.getAttribute('data-count-category');
      var n;
      if (key === 'all') n = allListings.length;
      else if (categoryKey) {
        n = countBy(function (item) {
          return item.category === categoryKey;
        });
        key = categoryKey;
      } else if (key) {
        n = countForFilterKey(key);
      } else {
        return;
      }
      if (el.tagName === 'OPTION') {
        var base = FILTER_OPTION_LABELS[key] || el.textContent.replace(/\s*\(\d+\)\s*$/, '').trim();
        el.textContent = base + ' (' + n + ')';
      } else {
        el.textContent = n;
      }
    });
  }

  function formatMetaVal(key, val) {
    if (catalog && catalog.formatMetaDisplayValue) {
      return catalog.formatMetaDisplayValue(key, val);
    }
    return val;
  }

  function metaCellHtml(m, item) {
    var scarcity = catalog && catalog.isScarcityMeta(m.key, m.val);
    var isInvestment = /^investment$/i.test(m.key);
    var investUi = window.HubOpportunityInvestment;
    var infoBtn =
      isInvestment && investUi && item ? investUi.infoButtonHtml(item) : '';
    return (
      '<div class="opp-meta-cell' +
      (scarcity ? ' opp-meta-cell--scarcity' : '') +
      (isInvestment && infoBtn ? ' opp-meta-cell--has-invest-info' : '') +
      '"><span class="opp-meta-k">' +
      escapeHtml(m.key) +
      '</span><span class="opp-meta-v-wrap"><span class="opp-meta-v">' +
      escapeHtml(formatMetaVal(m.key, m.val)) +
      '</span>' +
      infoBtn +
      '</span></div>'
    );
  }

  function companyAvatarHtml(item) {
    var logo = item.logoUrl || '';
    if (logo) {
      return (
        '<div class="opp-co-avatar opp-co-avatar--logo" aria-hidden="true">' +
        '<img src="' +
        escapeHtml(logo) +
        '" alt="" width="24" height="24" loading="lazy" decoding="async" />' +
        '</div>'
      );
    }
    return (
      '<div class="opp-co-avatar" style="background:' +
      escapeHtml(item.hostColor) +
      '" aria-hidden="true">' +
      escapeHtml(item.hostInitials) +
      '</div>'
    );
  }

  function cardBadgesHtml(item, typeClassFn, typeLabels) {
    return (
      '<div class="opp-card-head">' +
      '<div class="opp-card-badges">' +
      '<span class="opp-type-tag ' +
      typeClassFn(item.type) +
      '">' +
      escapeHtml(typeLabels[item.type] || item.type) +
      '</span>' +
      (item.featured ? '<span class="opp-feat-pip">Featured</span>' : '') +
      '</div></div>'
    );
  }

  function mediaBlockHtml(item, thumb) {
    if (item.imageUrl) {
      return (
        '<div class="opp-card-media opp-card-media--image">' +
        '<img class="opp-card-media-img" src="' +
        escapeHtml(item.imageUrl) +
        '" alt="" loading="lazy" decoding="async" />' +
        '</div>'
      );
    }
    return (
      '<div class="opp-card-media opp-card-media--placeholder" style="background:' +
      escapeHtml(thumb.gradient) +
      '">' +
      '<span class="opp-card-media-emoji" aria-hidden="true">' +
      thumb.emoji +
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
      cardBadgesHtml(item, typeClassFn, typeLabels) +
      mediaBlockHtml(item, thumb) +
      '<div class="opp-card-body">' +
      '<div class="opp-company">' +
      companyAvatarHtml(item) +
      '<span class="opp-co-name">' +
      escapeHtml(item.host) +
      '</span></div>' +
      '<h3 class="opp-card-title">' +
      escapeHtml(item.title) +
      '</h3>' +
      '<p class="opp-card-desc">' +
      escapeHtml(item.desc) +
      '</p>' +
      (quality && quality.trustBadgesHtml ? quality.trustBadgesHtml(item, 'opp-trust-badges opp-trust-badges--card') : '') +
      '<div class="opp-meta-row">' +
      displayMeta.map(function (m) {
        return metaCellHtml(m, item);
      }).join('') +
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
      '<a class="opp-card-link" href="' +
      escapeHtml(href) +
      '" aria-label="View ' +
      escapeHtml(item.title) +
      '"></a>' +
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

  function resetListingPagination() {
    accumulatedCount = 0;
    lastRenderedCount = 0;
    visibleRangeStart = 1;
    loadingMore = false;
    currentPage = 1;
    disconnectLazyObserver();
  }

  function disconnectLazyObserver() {
    if (lazyObserver) {
      lazyObserver.disconnect();
      lazyObserver = null;
    }
  }

  function getListingSlice(filtered) {
    var total = filtered.length;
    var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    if (accumulatedCount > 0) {
      var accEnd = Math.min(accumulatedCount, total);
      return {
        items: filtered.slice(0, accEnd),
        rangeStart: total ? 1 : 0,
        rangeEnd: accEnd,
        totalPages: totalPages,
        hasMore: accEnd < total,
      };
    }

    var start = (currentPage - 1) * PAGE_SIZE;
    var end = Math.min(start + PAGE_SIZE, total);
    return {
      items: filtered.slice(start, end),
      rangeStart: total ? start + 1 : 0,
      rangeEnd: end,
      totalPages: totalPages,
      hasMore: end < total,
    };
  }

  function listingsRangeHtml(rangeStart, rangeEnd, total) {
    if (!total || total <= PAGE_SIZE) return '';
    return (
      '<p class="opp-listings-range">Showing ' +
      rangeStart +
      '–' +
      rangeEnd +
      ' of ' +
      total +
      '</p>'
    );
  }

  function loadMoreHtml(filtered, shown) {
    var remaining = filtered.length - shown;
    if (remaining <= 0) return '';
    var batch = Math.min(PAGE_SIZE, remaining);
    return (
      '<div class="opp-load-more-wrap">' +
      '<button type="button" class="opp-load-more-btn" id="opp-load-more-btn">' +
      'Load more (' +
      batch +
      ' of ' +
      remaining +
      ' remaining)' +
      '</button></div>' +
      '<div class="opp-load-sentinel" id="opp-load-sentinel" aria-hidden="true"></div>'
    );
  }

  function updateResultsCount(shown, total, rangeStart, rangeEnd) {
    if (!els.resultsCount) return;
    if (!total) {
      els.resultsCount.innerHTML = activeCityName
        ? 'No opportunities in ' + activeCityName + ' match your filters'
        : 'No listings match your filters';
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

  function updateLoadMoreControls(filtered, shown, hasMore) {
    var wrap = els.mount && els.mount.querySelector('.opp-load-more-wrap');
    var btn = document.getElementById('opp-load-more-btn');
    var sentinel = document.getElementById('opp-load-sentinel');

    if (!hasMore) {
      if (wrap) wrap.remove();
      if (sentinel) sentinel.remove();
      disconnectLazyObserver();
      return;
    }

    var remaining = filtered.length - shown;
    var batch = Math.min(PAGE_SIZE, remaining);
    if (btn) {
      btn.disabled = loadingMore;
      btn.textContent = 'Load more (' + batch + ' of ' + remaining + ' remaining)';
    }
    observeLazySentinel();
  }

  function observeLazySentinel() {
    disconnectLazyObserver();
    if (!els.mount) return;
    var sentinel = els.mount.querySelector('.opp-load-sentinel');
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;

    lazyObserver = new IntersectionObserver(
      function (entries) {
        if (!entries[0] || !entries[0].isIntersecting || loadingMore) return;
        loadMoreListings();
      },
      { rootMargin: '280px 0px' }
    );
    lazyObserver.observe(sentinel);
  }

  function loadMoreListings() {
    if (loadingMore || !els.mount) return;

    var filtered = sortListings(getFilteredList());
    var slice = getListingSlice(filtered);
    if (!slice.hasMore) return;

    loadingMore = true;
    var prevShown = lastRenderedCount || slice.rangeEnd;
    var nextShown = Math.min(prevShown + PAGE_SIZE, filtered.length);

    if (!accumulatedCount) {
      accumulatedCount = nextShown;
    } else {
      accumulatedCount = nextShown;
    }

    var newItems = filtered.slice(prevShown, nextShown);
    var grid = els.mount.querySelector('.opp-opps-grid');

    if (grid && newItems.length) {
      grid.insertAdjacentHTML('beforeend', newItems.map(cardHtml).join(''));
      lastRenderedCount = nextShown;
      if (saves) saves.refreshButtons(els.mount);

      var rangeEl = els.mount.querySelector('.opp-listings-range');
      if (rangeEl) {
        rangeEl.textContent =
          'Showing ' + visibleRangeStart + '–' + nextShown + ' of ' + filtered.length;
      } else if (filtered.length > PAGE_SIZE) {
        var gridEl = els.mount.querySelector('.opp-opps-grid');
        if (gridEl) {
          gridEl.insertAdjacentHTML(
            'beforebegin',
            '<p class="opp-listings-range">Showing ' +
              visibleRangeStart +
              '–' +
              nextShown +
              ' of ' +
              filtered.length +
              '</p>'
          );
        }
      }

      updateResultsCount(
        nextShown - visibleRangeStart + 1,
        filtered.length,
        visibleRangeStart,
        nextShown
      );
      updateLoadMoreControls(filtered, nextShown, nextShown < filtered.length);
      loadingMore = false;
      return;
    }

    loadingMore = false;
    renderListings();
  }

  function syncTabUI() {
    if (!els.stripFilters) return;
    els.stripFilters.querySelectorAll('.opp-tab-btn').forEach(function (btn) {
      var on = btn.getAttribute('data-filter') === activeType;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  function syncCategorySelect() {
    if (!els.filterCategory) return;
    els.filterCategory.value = activeCategory || '';
    els.filterCategory.classList.toggle('is-active', Boolean(activeCategory));
  }

  function syncCatPills() {
    syncCategorySelect();
  }

  function renderListings() {
    if (!els.mount) return;

    var filtered = sortListings(getFilteredList());

    if (viewMode === 'map') {
      if (!filtered.length) {
        updateResultsCount(0, 0, 0, 0);
      } else if (els.resultsCount) {
        els.resultsCount.innerHTML =
          'Showing <strong>' + filtered.length + '</strong> opportunities';
      }
      if (window.hubRefreshOpportunitiesMap) window.hubRefreshOpportunitiesMap(filtered);
      return;
    }

    if (!filtered.length) {
      disconnectLazyObserver();
      var emptyTitle = activeCityName
        ? 'No opportunities in ' + escapeHtml(activeCityName) + ' yet'
        : 'No opportunities match your filters';
      var emptyLead = activeCityName
        ? 'Try clearing filters or browse all UK listings.'
        : 'Try adjusting your search or clear all filters.';
      els.mount.innerHTML =
        '<div class="opp-no-results is-visible" role="status">' +
        '<div class="opp-no-results-icon" aria-hidden="true">🔍</div>' +
        '<h3>' +
        emptyTitle +
        '</h3>' +
        '<p>' +
        emptyLead +
        ' <button type="button" class="opp-clear-btn" id="opp-clear-filters">Clear filters</button>.</p>' +
        '</div>';
      updateResultsCount(0, 0, 0, 0);
      bindClearFilters();
      return;
    }

    var slice = getListingSlice(filtered);
    var gridClass = 'opp-opps-grid' + (viewMode === 'list' ? ' list-view' : '');

    els.mount.innerHTML =
      listingsRangeHtml(slice.rangeStart, slice.rangeEnd, filtered.length) +
      '<div class="' +
      gridClass +
      '">' +
      slice.items.map(cardHtml).join('') +
      '</div>' +
      (slice.hasMore ? loadMoreHtml(filtered, slice.rangeEnd) : '') +
      paginationHtml(currentPage, slice.totalPages);

    lastRenderedCount = slice.rangeEnd;
    updateResultsCount(slice.items.length, filtered.length, slice.rangeStart, slice.rangeEnd);
    if (saves) saves.refreshButtons(els.mount);
    if (slice.hasMore) observeLazySentinel();
    else disconnectLazyObserver();
  }

  function bindClearFilters() {
    var btn = document.getElementById('opp-clear-filters');
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', resetFilters);
  }

  function readSidebarFilters() {
    sidebarFilters = [];
    var invest = sidebarSelectValue(els.filterInvest);
    var location = sidebarSelectValue(els.filterLocation);
    var commitment = sidebarSelectValue(els.filterCommitment);
    if (invest) sidebarFilters.push(invest);
    if (location) sidebarFilters.push(location);
    if (commitment) sidebarFilters.push(commitment);
  }

  function readInvestRange() {
    minInvest = els.minInvest && els.minInvest.value !== '' ? parseInt(els.minInvest.value, 10) : null;
    maxInvest = els.maxInvest && els.maxInvest.value !== '' ? parseInt(els.maxInvest.value, 10) : null;
    if (isNaN(minInvest)) minInvest = null;
    if (isNaN(maxInvest)) maxInvest = null;
  }

  function syncSidebarSelectUI() {
    [els.filterCategory, els.filterInvest, els.filterLocation, els.filterCommitment].forEach(function (select) {
      if (!select) return;
      select.classList.toggle('is-active', Boolean(select.value));
    });
  }

  function syncInvestPillsUI() {
    if (!els.investPills) return;
    var tier = '';
    var hasCustomRange = hasCustomInvestRange();
    if (!hasCustomRange && els.filterInvest) tier = els.filterInvest.value || '';
    els.investPills.querySelectorAll('.opp-invest-pill').forEach(function (btn) {
      var key = btn.getAttribute('data-invest-tier') || '';
      var pillTier = key === 'all' ? '' : key;
      var on = !hasCustomRange && pillTier === tier;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function setInvestTier(tier) {
    if (els.minInvest) els.minInvest.value = '';
    if (els.maxInvest) els.maxInvest.value = '';
    minInvest = null;
    maxInvest = null;
    if (els.filterInvest) els.filterInvest.value = tier || '';
    syncInvestPillsUI();
    applyFilters();
  }

  function currentFilterCriteria() {
    return {
      type: activeType,
      category: activeCategory || '',
      invest: els.filterInvest ? els.filterInvest.value || '' : '',
      location: els.filterLocation ? els.filterLocation.value || '' : '',
      commitment: els.filterCommitment ? els.filterCommitment.value || '' : '',
      q: searchQ || '',
      sort: sortBy || 'recommended',
      minInvest: minInvest != null ? minInvest : '',
      maxInvest: maxInvest != null ? maxInvest : '',
    };
  }

  function readFiltersFromUrl() {
    syncRegionalLanding();
    var params = new URLSearchParams(window.location.search);
    var type = params.get('type');
    if (type && TAB_TYPES.indexOf(type) !== -1) activeType = type;

    activeCategory = params.get('category') || '';
    searchQ = String(params.get('q') || '').trim().toLowerCase();
    sortBy = params.get('sort') || 'recommended';

    if (els.search && searchQ) els.search.value = searchQ;
    if (els.sort) els.sort.value = sortBy;
    if (els.filterCategory && activeCategory) els.filterCategory.value = activeCategory;
    if (els.filterInvest) els.filterInvest.value = params.get('invest') || '';
    if (els.filterLocation) els.filterLocation.value = params.get('location') || '';
    if (els.filterCommitment) els.filterCommitment.value = params.get('commitment') || '';

    var min = params.get('min');
    var max = params.get('max');
    minInvest = min !== null && min !== '' ? parseInt(min, 10) : null;
    maxInvest = max !== null && max !== '' ? parseInt(max, 10) : null;
    if (isNaN(minInvest)) minInvest = null;
    if (isNaN(maxInvest)) maxInvest = null;
    if (els.minInvest && minInvest != null) els.minInvest.value = String(minInvest);
    if (els.maxInvest && maxInvest != null) els.maxInvest.value = String(maxInvest);

    readSidebarFilters();
    updateSearchClearVisibility();
    pendingResultsScroll = Boolean(searchQ || window.location.hash === '#results');
  }

  function scrollToResultsAfterLanding() {
    if (!pendingResultsScroll) return;
    pendingResultsScroll = false;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var target = document.getElementById('results') || document.querySelector('.opp-listings-area');
        if (!target || !target.scrollIntoView) return;
        var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      });
    });
  }

  function writeFiltersToUrl() {
    var params = new URLSearchParams();
    var c = currentFilterCriteria();
    if (c.type && c.type !== 'all') params.set('type', c.type);
    if (c.category) params.set('category', c.category);
    if (c.invest) params.set('invest', c.invest);
    if (c.location) params.set('location', c.location);
    if (c.commitment) params.set('commitment', c.commitment);
    if (c.q) params.set('q', c.q);
    if (c.sort && c.sort !== 'recommended') params.set('sort', c.sort);
    if (c.minInvest !== '' && c.minInvest != null) params.set('min', String(c.minInvest));
    if (c.maxInvest !== '' && c.maxInvest != null) params.set('max', String(c.maxInvest));
    if (activeCitySlug) params.set('city', activeCitySlug);

    var qs = params.toString();
    var path = activeCitySlug
      ? '/opportunities/networking/' + encodeURIComponent(activeCitySlug)
      : window.location.pathname;
    var next = path + (qs ? '?' + qs : '') + (window.location.hash || '');
    var current = window.location.pathname + window.location.search + (window.location.hash || '');
    if (next !== current) {
      window.history.replaceState({}, '', next);
    }
  }

  function applyFilters() {
    readSidebarFilters();
    readInvestRange();
    syncSidebarSelectUI();
    syncInvestPillsUI();
    resetListingPagination();
    writeFiltersToUrl();
    renderListings();
  }

  function setType(type) {
    activeType = type || 'all';
    syncTabUI();
    applyFilters();
  }

  function resetFilters() {
    var regional = window.hubOppRegionalLanding;
    if (regional && regional.slug && !searchQ && !activeCategory && activeType === 'all') {
      var hasExtra =
        (els.filterInvest && els.filterInvest.value) ||
        (els.filterLocation && els.filterLocation.value) ||
        (els.filterCommitment && els.filterCommitment.value) ||
        minInvest !== null ||
        maxInvest !== null;
      if (!hasExtra) {
        window.location.href = '/opportunities/';
        return;
      }
    }

    activeType = 'all';
    activeCategory = '';
    searchQ = '';
    sortBy = 'recommended';
    sidebarFilters = [];
    minInvest = null;
    maxInvest = null;
    resetListingPagination();

    if (els.search) els.search.value = '';
    if (els.sort) els.sort.value = 'recommended';
    if (els.minInvest) els.minInvest.value = '';
    if (els.maxInvest) els.maxInvest.value = '';
    if (els.filterInvest) els.filterInvest.value = '';
    if (els.filterLocation) els.filterLocation.value = '';
    if (els.filterCommitment) els.filterCommitment.value = '';
    if (els.filterCategory) els.filterCategory.value = '';
    if (els.sidebar) {
      els.sidebar.querySelectorAll('details.opp-filter-details').forEach(function (details) {
        details.open = false;
      });
    }

    updateSearchClearVisibility();
    syncTabUI();
    syncCatPills();
    syncSidebarSelectUI();
    syncInvestPillsUI();
    writeFiltersToUrl();
    renderListings();
  }

  function setSaveSearchStatus(msg, isError) {
    if (!els.saveSearchStatus) return;
    els.saveSearchStatus.textContent = msg || '';
    els.saveSearchStatus.hidden = !msg;
    els.saveSearchStatus.classList.toggle('is-error', Boolean(isError));
  }

  function saveSearchAlert() {
    var criteria = currentFilterCriteria();
    var hasFilter =
      (criteria.type && criteria.type !== 'all') ||
      criteria.category ||
      criteria.invest ||
      criteria.location ||
      criteria.commitment ||
      criteria.q ||
      criteria.minInvest !== '' ||
      criteria.maxInvest !== '';

    if (!hasFilter) {
      setSaveSearchStatus('Set at least one filter before saving an alert.', true);
      return;
    }

    if (els.saveSearchBtn) els.saveSearchBtn.disabled = true;
    setSaveSearchStatus('Saving alert…');

    fetch('/api/auth/opportunity-saved-searches', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        criteria: criteria,
        label: quality && quality.criteriaLabel ? quality.criteriaLabel(criteria) : '',
      }),
    })
      .then(function (r) {
        return r.json().then(function (data) {
          return { status: r.status, data: data };
        });
      })
      .then(function (res) {
        if (res.status === 401) {
          window.location.href =
            '../register?return=' + encodeURIComponent(window.location.pathname + window.location.search);
          return;
        }
        if (!res.data || !res.data.ok) throw new Error((res.data && res.data.message) || 'Could not save alert');
        setSaveSearchStatus('Alert saved — we will email you when new listings match.');
      })
      .catch(function (e) {
        setSaveSearchStatus(e.message || 'Could not save alert. Try again.', true);
      })
      .finally(function () {
        if (els.saveSearchBtn) els.saveSearchBtn.disabled = false;
      });
  }

  function initCopyLink() {
    if (!els.copyLinkBtn || els.copyLinkBtn.dataset.bound) return;
    els.copyLinkBtn.dataset.bound = '1';
    els.copyLinkBtn.addEventListener('click', function () {
      writeFiltersToUrl();
      var url = window.location.href;
      function done(ok) {
        if (!els.copyLinkBtn) return;
        var prev = els.copyLinkBtn.textContent;
        els.copyLinkBtn.textContent = ok ? 'Link copied' : 'Copy failed';
        setTimeout(function () {
          if (els.copyLinkBtn) els.copyLinkBtn.textContent = prev;
        }, 1800);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () {
          done(true);
        }).catch(function () {
          done(false);
        });
        return;
      }
      try {
        var ta = document.createElement('textarea');
        ta.value = url;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        done(document.execCommand('copy'));
        ta.remove();
      } catch {
        done(false);
      }
    });
  }

  function initSaveSearch() {
    if (!els.saveSearchBtn || els.saveSearchBtn.dataset.bound) return;
    els.saveSearchBtn.dataset.bound = '1';
    els.saveSearchBtn.addEventListener('click', saveSearchAlert);
  }

  function initHubertStrip() {
    var strip = document.getElementById('opp-hubert-strip');
    if (!strip || strip.dataset.bound) return;
    strip.dataset.bound = '1';
    strip.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-hubert-prompt]');
      if (!btn) return;
      var prompt = btn.getAttribute('data-hubert-prompt') || '';
      if (window.HubertWidget && window.HubertWidget.ask) window.HubertWidget.ask(prompt);
      else if (window.HubertWidget && window.HubertWidget.open) window.HubertWidget.open();
    });
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

  function initInvestPills() {
    if (!els.investPills || els.investPills.dataset.bound) return;
    els.investPills.dataset.bound = '1';
    els.investPills.addEventListener('click', function (e) {
      var btn = e.target.closest('.opp-invest-pill');
      if (!btn) return;
      var tier = btn.getAttribute('data-invest-tier') || '';
      if (tier === 'all') tier = '';
      else if (els.filterInvest && els.filterInvest.value === tier && !hasCustomInvestRange()) {
        tier = '';
      }
      setInvestTier(tier);
    });
  }

  function initSidebar() {
    if (!els.sidebar || els.sidebar.dataset.bound) return;
    els.sidebar.dataset.bound = '1';
    rememberFilterOptionLabels();

    els.sidebar.addEventListener('change', function (e) {
      if (e.target === els.filterCategory) {
        activeCategory = e.target.value || '';
        applyFilters();
        return;
      }
      if (e.target.matches('.opp-filter-select')) {
        if (e.target === els.filterInvest && e.target.value) {
          if ((els.minInvest && els.minInvest.value !== '') || (els.maxInvest && els.maxInvest.value !== '')) {
            if (els.minInvest) els.minInvest.value = '';
            if (els.maxInvest) els.maxInvest.value = '';
            minInvest = null;
            maxInvest = null;
          }
        }
        applyFilters();
      }
    });

    [els.minInvest, els.maxInvest].forEach(function (input) {
      if (!input) return;
      input.addEventListener('input', function () {
        if (input.value !== '' && els.filterInvest) els.filterInvest.value = '';
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
        resetListingPagination();
        writeFiltersToUrl();
        renderListings();
      }, SEARCH_DEBOUNCE_MS);
    });

    var clearBtn = document.getElementById('opp-search-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        els.search.value = '';
        els.search.focus();
        searchQ = '';
        resetListingPagination();
        updateSearchClearVisibility();
        writeFiltersToUrl();
        renderListings();
      });
    }
  }

  function initSort() {
    if (!els.sort || els.sort.dataset.bound) return;
    els.sort.dataset.bound = '1';
    els.sort.addEventListener('change', function () {
      sortBy = els.sort.value || 'recommended';
      resetListingPagination();
      writeFiltersToUrl();
      renderListings();
    });
  }

  function syncViewToggleUI() {
    if (els.viewGrid) {
      els.viewGrid.classList.toggle('is-active', viewMode === 'grid');
      els.viewGrid.setAttribute('aria-pressed', viewMode === 'grid' ? 'true' : 'false');
    }
    if (els.viewList) {
      els.viewList.classList.toggle('is-active', viewMode === 'list');
      els.viewList.setAttribute('aria-pressed', viewMode === 'list' ? 'true' : 'false');
    }
    if (els.viewMap) {
      els.viewMap.classList.toggle('is-active', viewMode === 'map');
      els.viewMap.setAttribute('aria-pressed', viewMode === 'map' ? 'true' : 'false');
    }
  }

  function initViewToggle() {
    function setView(mode) {
      var wasMap = viewMode === 'map';
      viewMode = mode;
      syncViewToggleUI();
      if (mode === 'map') {
        if (window.hubSetOppMapView) window.hubSetOppMapView(true);
        renderListings();
        return;
      }
      if (wasMap && window.hubSetOppMapView) window.hubSetOppMapView(false);
      renderListings();
    }

    if (els.viewGrid) els.viewGrid.addEventListener('click', function () {
      setView('grid');
    });
    if (els.viewList) els.viewList.addEventListener('click', function () {
      setView('list');
    });
    if (els.viewMap) els.viewMap.addEventListener('click', function () {
      setView('map');
    });
    syncViewToggleUI();
  }

  function initCatPills() {
    syncCategorySelect();
  }

  function findListingById(id) {
    var key = String(id || '');
    for (var i = 0; i < allListings.length; i++) {
      if (String(allListings[i].id) === key) return allListings[i];
    }
    return null;
  }

  function handleFavClick(fav) {
    if (!fav || !saves || fav.disabled) return;
    var oppId = fav.getAttribute('data-opp-id');
    if (!oppId) return;
    fav.disabled = true;
    saves
      .toggle(oppId, findListingById(oppId))
      .then(function () {
        saves.refreshButtons(document);
      })
      .finally(function () {
        fav.disabled = false;
      });
  }

  function initFavClicks() {
    if (document.body.dataset.oppFavBound) return;
    document.body.dataset.oppFavBound = '1';
    document.addEventListener('click', function (e) {
      var fav = e.target.closest('.opp-fav-btn');
      if (!fav || !document.body.classList.contains('opp-browse-page')) return;
      e.preventDefault();
      e.stopPropagation();
      handleFavClick(fav);
    });
  }

  function initPagination() {
    if (!els.mount || els.mount.dataset.paginationBound) return;
    els.mount.dataset.paginationBound = '1';

    els.mount.addEventListener('click', function (e) {
      if (e.target.closest('.opp-fav-btn')) return;

      var loadBtn = e.target.closest('.opp-load-more-btn');
      if (loadBtn) {
        loadMoreListings();
        return;
      }

      var btn = e.target.closest('.opp-page-btn');
      if (!btn || btn.disabled) return;
      var filtered = getFilteredList();
      var totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
      var p = parseInt(btn.getAttribute('data-page'), 10);
      if (!p || p === currentPage || p < 1 || p > totalPages) return;
      accumulatedCount = 0;
      lastRenderedCount = 0;
      currentPage = p;
      visibleRangeStart = (p - 1) * PAGE_SIZE + 1;
      renderListings();
      var listingsArea = document.querySelector('.opp-listings-area');
      if (listingsArea) listingsArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    readFiltersFromUrl();
    allListings = catalog ? catalog.loadCatalog() : [];
    if (window.HubOpportunityInvestment) {
      window.HubOpportunityInvestment.bindCardPopovers(function (id) {
        for (var i = 0; i < allListings.length; i++) {
          if (String(allListings[i].id) === String(id)) return allListings[i];
        }
        return null;
      });
    }
    updateFilterCounts();
    initStripTabs();
    initInvestPills();
    initSidebar();
    initSearch();
    initSort();
    initViewToggle();
    initCatPills();
    initPagination();
    initFavClicks();
    initCopyLink();
    initSaveSearch();
    initHubertStrip();
    syncTabUI();
    resetSpotlightOrder();
    renderSpotlight();
    renderListings();
    scrollToResultsAfterLanding();

    if (catalog && catalog.loadCatalogAsync) {
      catalog.loadCatalogAsync().then(function (merged) {
        if (saves) saves.refreshButtons(document);
        if (!merged || !merged.length) return;
        var prevIds = allListings.map(function (item) {
          return item.id;
        }).join(',');
        var nextIds = merged.map(function (item) {
          return item.id;
        }).join(',');
        if (prevIds !== nextIds) bootListings(merged);
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

  window.hubGetFilteredOpportunities = function () {
    return sortListings(getFilteredList());
  };

  window.hubRenderOpportunities = function (listings) {
    if (!catalog) return;
    allListings = (listings || []).map(function (item, i) {
      return catalog.normalizeListing(item, i);
    });
    updateFilterCounts();
    resetListingPagination();
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
