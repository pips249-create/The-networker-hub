/**
 * Opportunities — browse page with events-style filter bar, grid cards & map view.
 */
(function () {
  var PAGE_SIZE = 12;
  var SEARCH_DEBOUNCE_MS = 200;
  var SPOTLIGHT_MAX = 12; /* sync with api/_lib/spotlight-carousel-limits.js */
  var SPOTLIGHT_AUTO_MS = 2800;
  var VIEW_MODE_KEY = 'hubOppViewMode';
  var VIEW_MODES = ['grid', 'map'];
  var DEFAULT_VIEW_MODE = 'grid';

  var TYPE_CHIPS = [
    { id: 'all', label: 'All' },
    { id: 'franchise', label: 'Franchise' },
    { id: 'side-hustle', label: 'Side hustle' },
    { id: 'partnership', label: 'Partnership' },
    { id: 'networking', label: 'Networking' },
    { id: 'distributorship', label: 'Distributorship' },
    { id: 'business-opportunity', label: 'Business opportunity' },
  ];

  var COMMITMENTS = [
    { id: 'full-time', label: 'Full-time' },
    { id: 'part-time', label: 'Part-time / Flexible' },
    { id: 'event-based', label: 'Event-based' },
  ];

  var META_PIN_SVG =
    '<svg class="premium-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';
  var META_HOST_SVG =
    '<svg class="premium-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

  var catalog = window.HubOpportunitiesCatalog;
  var saves = window.HubOpportunitySaves;
  var quality = window.HubOpportunityQuality;

  var FAV_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
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
  var activeTypes = [];
  var activeInvestTier = 'all';
  var activeCategory = '';
  var activeCommitments = [];
  var activeLocationTag = '';
  var locationQ = '';
  var FILTER_OPTION_LABELS = {};
  var searchQ = '';
  var sortBy = 'recommended';
  var viewMode = DEFAULT_VIEW_MODE;
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
  var expandedCardId = null;

  var els = {};

  function normalizeViewMode(mode) {
    var value = String(mode || '').trim().toLowerCase();
    return VIEW_MODES.indexOf(value) !== -1 ? value : DEFAULT_VIEW_MODE;
  }

  function loadStoredViewMode() {
    try {
      return normalizeViewMode(localStorage.getItem(VIEW_MODE_KEY));
    } catch (e) {
      return DEFAULT_VIEW_MODE;
    }
  }

  function saveViewMode(mode) {
    try {
      localStorage.setItem(VIEW_MODE_KEY, normalizeViewMode(mode));
    } catch (e) {
      /* ignore */
    }
  }

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
    if (!activeCitySlug) return true;
    if (item.matchesAllCities) return true;
    if (item.citySlugs && item.citySlugs.indexOf(activeCitySlug) !== -1) return true;
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
    return hay.indexOf(city) !== -1;
  }

  function cacheEls() {
    els.mount = document.getElementById('opp-listings-mount');
    els.resultsCount = document.getElementById('opp-results-count');
    els.search = document.getElementById('opp-search');
    els.sort = document.getElementById('opp-sort');
    els.postcode = document.getElementById('opp-postcode');
    els.typeChipsRoot = document.getElementById('opp-type-chips');
    els.minInvest = document.getElementById('opp-min-invest');
    els.maxInvest = document.getElementById('opp-max-invest');
    els.filterCategory = document.getElementById('opp-filter-category');
    els.moreToggle = document.getElementById('filter-more-toggle');
    els.morePanel = document.getElementById('filter-more-panel');
    els.clearBar = document.getElementById('clear-filters-bar');
    els.clearResults = document.getElementById('clear-filters');
    els.viewGrid = document.getElementById('opp-view-grid');
    els.viewMap = document.getElementById('opp-view-map');
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
    var sc = window.HubSpotlightCarousel;
    var track = els.spotlightTrack;
    var featured = getSpotlightFeatured();
    if (!sc || !track || !featured.length) return 0;
    return sc.measureLoopWidth(track, featured.length, '.opp-premium-card');
  }

  function syncSpotlightLoopScroll() {
    var sc = window.HubSpotlightCarousel;
    var track = els.spotlightTrack;
    if (!sc || !track) return;
    var loopWidth = measureSpotlightLoopWidth();
    sc.syncLoopScroll(track, loopWidth);
  }

  function layoutSpotlightTrack(cardsHtml, itemCount) {
    var sc = window.HubSpotlightCarousel;
    if (!sc || !els.spotlightTrack) return;
    var section = els.spotlightSection || els.spotlightTrack.closest('.premium-spotlight');
    sc.applyLoopLayout(els.spotlightTrack, section, itemCount, '.opp-premium-card', cardsHtml);
  }

  function refreshSpotlightLayout() {
    var featured = getSpotlightFeatured();
    if (!els.spotlightTrack || !featured.length) return;
    layoutSpotlightTrack(featured.map(premiumSpotlightCard).join(''), featured.length);
    syncSpotlightLoopScroll();
    startSpotlightAuto();
  }

  function advanceSpotlight(dir) {
    dir = dir < 0 ? -1 : 1;
    var featured = getSpotlightFeatured();
    var track = els.spotlightTrack;
    var sc = window.HubSpotlightCarousel;
    if (!featured.length || featured.length <= 1 || !track || spotlightAnimating) return;

    spotlightAnimating = true;
    stopSpotlightAuto();

    var step = getSpotlightCardStep() * dir;
    var looping = sc && sc.isLooping(track);
    var loopWidth =
      looping && sc
        ? parseFloat(track.dataset.loopWidth) || sc.measureLoopWidth(track, featured.length, '.opp-premium-card')
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

  function startSpotlightAuto() {
    stopSpotlightAuto();
    var sc = window.HubSpotlightCarousel;
    if (!els.spotlightTrack || !sc || !sc.canAutoAdvance(els.spotlightTrack, getSpotlightFeatured().length)) return;
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
        if (!spotlightAnimating) refreshSpotlightLayout();
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
        '" alt="' +
        escapeHtml(item.title || 'Opportunity cover') +
        '" loading="lazy" decoding="async" />'
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
    els.spotlightTrack.classList.add('spotlight-track--carousel');
    if (promo) promo.hidden = false;
    bindSpotlightCarousel();
    requestAnimationFrame(function () {
      layoutSpotlightTrack(cardsHtml, featured.length);
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
    if (!tag) return true;
    if (item.type === tag) return true;
    return (item.filterTags || []).concat(item.tags || []).indexOf(tag) !== -1;
  }

  function investmentLabel(item) {
    if (catalog && catalog.cardDisplayMeta) {
      var meta = catalog.cardDisplayMeta(item);
      for (var i = 0; i < meta.length; i++) {
        if (/investment/i.test(meta[i].key) && meta[i].val) return String(meta[i].val);
      }
    }
    if (item.investAmount != null && !isNaN(item.investAmount)) {
      if (item.investAmount <= 0) return 'Enquire';
      if (item.investAmount >= 1000) return 'From £' + Math.round(item.investAmount / 1000) + 'k';
      return 'From £' + item.investAmount;
    }
    return 'Enquire';
  }

  function commitmentLabel(item) {
    var tags = item.filterTags || [];
    for (var i = 0; i < COMMITMENTS.length; i++) {
      if (tags.indexOf(COMMITMENTS[i].id) !== -1) return COMMITMENTS[i].label;
    }
    return 'Flexible';
  }

  function investTierClass(tier) {
    if (tier === 'low-invest') return 'investment-low';
    if (tier === 'mid-invest') return 'investment-mid';
    if (tier === 'high-invest') return 'investment-high';
    return 'investment-mid';
  }

  function detectInvestTier(item) {
    var amount = item.investAmount;
    if (amount == null || isNaN(amount)) {
      if (hasTag(item, 'low-invest')) return 'low-invest';
      if (hasTag(item, 'mid-invest')) return 'mid-invest';
      if (hasTag(item, 'high-invest')) return 'high-invest';
      return 'mid-invest';
    }
    if (amount <= 2500) return 'low-invest';
    if (amount <= 10000) return 'mid-invest';
    return 'high-invest';
  }

  function mediaHtml(item, thumb) {
    if (item.imageUrl) {
      var logoClass = item.logoUrl ? ' is-logo-cover' : '';
      return (
        '<img class="event-grid-img' +
        logoClass +
        '" src="' +
        escapeHtml(item.imageUrl) +
        '" alt="' +
        escapeHtml(item.title || 'Opportunity cover') +
        '" loading="lazy" decoding="async" />'
      );
    }
    return (
      '<div class="event-grid-img is-placeholder" style="display:flex;align-items:center;justify-content:center;background:' +
      escapeHtml(thumb.gradient) +
      ';font-size:2.4rem">' +
      thumb.emoji +
      '</div>'
    );
  }

  function matchesLocation(item) {
    if (activeLocationTag && !hasTag(item, activeLocationTag)) return false;
    if (!locationQ) return true;
    var hay = [item.locationLabel, item.searchText, item.title, item.host, (item.tags || []).join(' ')]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.indexOf(locationQ) !== -1;
  }

  function matchesInvestTier(item) {
    if (!activeInvestTier || activeInvestTier === 'all') return true;
    return hasTag(item, activeInvestTier);
  }

  function matchesCommitments(item) {
    if (!activeCommitments.length) return true;
    for (var i = 0; i < activeCommitments.length; i++) {
      if (hasTag(item, activeCommitments[i])) return true;
    }
    return false;
  }

  function matchesTypes(item) {
    if (!activeTypes.length) return true;
    for (var i = 0; i < activeTypes.length; i++) {
      if (hasTag(item, activeTypes[i])) return true;
    }
    return false;
  }

  function hasCustomInvestRange() {
    return minInvest !== null || maxInvest !== null;
  }

  function matchesFilter(item) {
    if (activeCitySlug && !matchesCityRegion(item)) return false;
    if (!matchesTypes(item)) return false;
    if (activeCategory && item.category !== activeCategory) return false;
    if (!matchesInvestTier(item)) return false;
    if (!matchesCommitments(item)) return false;
    if (!matchesLocation(item)) return false;
    if (searchQ && item.searchText.indexOf(searchQ) === -1) return false;
    if (minInvest !== null && (item.investAmount === null || item.investAmount < minInvest)) return false;
    if (maxInvest !== null && (item.investAmount === null || item.investAmount > maxInvest)) return false;
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
    document.querySelectorAll('#opp-filter-category option[data-count-category]').forEach(function (opt) {
      var key = opt.getAttribute('data-count-category');
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
    updateTypeChipCounts();
    document.querySelectorAll('[data-count-category]').forEach(function (el) {
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
        '" alt="" width="24" height="24" loading="lazy" decoding="async" aria-hidden="true" />' +
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

  function cardDetailHtml(item) {
    var href = detailHref(item);
    var displayMeta = catalog ? catalog.cardDisplayMeta(item) : (item.meta || []).slice(0, 4);
    var locIcon = /remote/i.test(item.locationLabel || '') ? '🌐' : '📍';

    while (displayMeta.length < 4) {
      displayMeta.push({ key: '\u00a0', val: '—' });
    }

    return (
      '<div class="bo-opp-detail-inner">' +
      '<div class="opp-company">' +
      companyAvatarHtml(item) +
      '<span class="opp-co-name">' +
      escapeHtml(item.host || 'Provider') +
      '</span></div>' +
      '<p class="opp-card-desc">' +
      escapeHtml(item.desc || '') +
      '</p>' +
      (quality && quality.trustBadgesHtml
        ? quality.trustBadgesHtml(item, 'opp-trust-badges opp-trust-badges--card')
        : '') +
      '<div class="opp-meta-row">' +
      displayMeta
        .map(function (m) {
          return metaCellHtml(m, item);
        })
        .join('') +
      '</div>' +
      '<div class="bo-opp-detail-footer">' +
      '<span class="opp-location">' +
      locIcon +
      ' ' +
      escapeHtml(item.locationLabel || 'UK') +
      '</span>' +
      '<a href="' +
      escapeHtml(href) +
      '" class="opp-enquire-btn">Enquire →</a>' +
      '</div></div>'
    );
  }

  function mediaBlockHtml(item, thumb) {
    if (item.imageUrl) {
      return (
        '<div class="opp-card-media opp-card-media--image">' +
        '<img class="opp-card-media-img" src="' +
        escapeHtml(item.imageUrl) +
        '" alt="' +
        escapeHtml(item.title || 'Opportunity cover') +
        '" loading="lazy" decoding="async" />' +
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

  function gridCard(item) {
    var href = detailHref(item);
    var typeLabels = catalog ? catalog.TYPE_LABELS : {};
    var typeLabel = typeLabels[item.type] || item.type || 'Opportunity';
    var thumb = item.thumb || { emoji: '✦', gradient: 'linear-gradient(135deg,#fdf6e3,#f5e0a0)' };
    var invest = investmentLabel(item);
    var commitment = commitmentLabel(item);
    var tier = detectInvestTier(item);
    var metaLine = [item.locationLabel || 'UK', invest].filter(Boolean).join(' · ');
    var premiumBadge = item.featured ? '<span class="event-grid-premium">Premium</span>' : '';
    var detailId = 'bo-opp-detail-' + String(item.id).replace(/[^a-z0-9_-]/gi, '');

    return (
      '<article class="event-grid-card bo-opp-card' +
      (item.featured ? ' is-premium' : '') +
      '" data-id="' +
      escapeHtml(item.id) +
      '">' +
      '<div class="bo-opp-compact">' +
      '<div class="event-grid-media">' +
      mediaHtml(item, thumb) +
      premiumBadge +
      '<span class="event-grid-category">' +
      escapeHtml(typeLabel) +
      '</span></div>' +
      '<div class="event-grid-body">' +
      '<div class="event-grid-body-top">' +
      '<span class="event-grid-format ' +
      investTierClass(tier) +
      '">' +
      escapeHtml(commitment) +
      '</span>' +
      '<span class="event-grid-price">' +
      escapeHtml(invest) +
      '</span></div>' +
      '<h3 class="event-grid-title">' +
      escapeHtml(item.title) +
      '</h3>' +
      '<div class="event-grid-rating">' +
      '<span class="event-grid-host">' +
      escapeHtml(item.host || 'Provider') +
      '</span>' +
      '<button type="button" class="fav-btn opp-fav-btn' +
      (saves && saves.isSaved(item.id) ? ' is-active' : '') +
      '" data-opp-id="' +
      escapeHtml(item.id) +
      '" aria-label="' +
      (saves && saves.isSaved(item.id) ? 'Remove from saved' : 'Save opportunity') +
      '" aria-pressed="' +
      (saves && saves.isSaved(item.id) ? 'true' : 'false') +
      '">' +
      FAV_ICON +
      '</button></div>' +
      '<p class="event-grid-meta">' +
      escapeHtml(metaLine) +
      '</p>' +
      '<button type="button" class="bo-opp-expand-btn" aria-expanded="false" aria-controls="' +
      escapeHtml(detailId) +
      '">' +
      '<span class="bo-opp-expand-label">Show full details</span>' +
      '<svg class="bo-opp-expand-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>' +
      '</button></div></div>' +
      '<div class="bo-opp-detail" id="' +
      escapeHtml(detailId) +
      '" hidden>' +
      cardDetailHtml(item) +
      '</div>' +
      '<a class="event-grid-card-link" href="' +
      escapeHtml(href) +
      '" aria-label="View ' +
      escapeHtml(item.title) +
      '"></a></article>'
    );
  }

  function setCardExpanded(card, expand) {
    if (!card) return;
    var btn = card.querySelector('.bo-opp-expand-btn');
    var detail = card.querySelector('.bo-opp-detail');
    var label = btn && btn.querySelector('.bo-opp-expand-label');
    var id = card.getAttribute('data-id');

    card.classList.toggle('is-expanded', expand);
    if (detail) detail.hidden = !expand;
    if (btn) {
      btn.setAttribute('aria-expanded', expand ? 'true' : 'false');
      if (label) label.textContent = expand ? 'Hide full details' : 'Show full details';
    }
    expandedCardId = expand ? id : null;
  }

  function bindCardExpand() {
    if (!els.mount || els.mount.dataset.expandBound === '1') return;
    els.mount.dataset.expandBound = '1';

    els.mount.addEventListener('click', function (e) {
      var btn = e.target.closest('.bo-opp-expand-btn');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();

      var card = btn.closest('.bo-opp-card');
      if (!card) return;

      var willExpand = !card.classList.contains('is-expanded');
      els.mount.querySelectorAll('.bo-opp-card.is-expanded').forEach(function (openCard) {
        if (openCard !== card) setCardExpanded(openCard, false);
      });
      setCardExpanded(card, willExpand);

      if (willExpand && window.HubOpportunityInvestment && window.HubOpportunityInvestment.bindCardPopovers) {
        window.HubOpportunityInvestment.bindCardPopovers(function (lookupId) {
          for (var i = 0; i < allListings.length; i++) {
            if (String(allListings[i].id) === String(lookupId)) return allListings[i];
          }
          return null;
        });
      }
    });
  }

  function restoreExpandedCard() {
    if (!expandedCardId || !els.mount) return;
    var card = els.mount.querySelector('.bo-opp-card[data-id="' + expandedCardId + '"]');
    if (card) setCardExpanded(card, true);
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
        '"' +
        (page <= 1 ? ' disabled' : '') +
        ' aria-label="Previous page">‹</button>'
    );

    for (var p = start; p <= end; p++) {
      items.push(
        '<button type="button" class="page-btn' +
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

    items.push(
      '<button type="button" class="page-btn page-next" data-page="' +
        (page + 1) +
        '"' +
        (page >= totalPages ? ' disabled' : '') +
        ' aria-label="Next page">›</button>'
    );

    return '<nav class="listings-pagination" aria-label="Opportunity pages">' + items.join('') + '</nav>';
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

  function updateResultsCount(total) {
    if (!els.resultsCount) return;
    els.resultsCount.textContent = String(total);
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
    var grid = els.mount.querySelector('.event-grid');

    if (grid && newItems.length) {
      grid.insertAdjacentHTML('beforeend', newItems.map(gridCard).join(''));
      lastRenderedCount = nextShown;
      if (saves) saves.refreshButtons(els.mount);

      var rangeEl = els.mount.querySelector('.opp-listings-range');
      if (rangeEl) {
        rangeEl.textContent =
          'Showing ' + visibleRangeStart + '–' + nextShown + ' of ' + filtered.length;
      } else if (filtered.length > PAGE_SIZE) {
        var gridEl = els.mount.querySelector('.event-grid');
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

      updateResultsCount(filtered.length);
      updateLoadMoreControls(filtered, nextShown, nextShown < filtered.length);
      loadingMore = false;
      restoreExpandedCard();
      return;
    }

    loadingMore = false;
    renderListings();
  }

  function syncTypeChipUi() {
    if (!els.typeChipsRoot) return;
    var hasSelection = activeTypes.length > 0;
    els.typeChipsRoot.querySelectorAll('.event-type-chip[data-type]').forEach(function (chip) {
      var type = chip.getAttribute('data-type') || 'all';
      var active = type === 'all' ? !hasSelection : activeTypes.indexOf(type) !== -1;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function toggleType(type) {
    type = type || 'all';
    if (type === 'all') {
      activeTypes = [];
    } else {
      var idx = activeTypes.indexOf(type);
      if (idx >= 0) activeTypes.splice(idx, 1);
      else activeTypes.push(type);
    }
    syncTypeChipUi();
  }

  function buildTypeChips() {
    if (!els.typeChipsRoot) return;
    els.typeChipsRoot.innerHTML = TYPE_CHIPS.map(function (chip, index) {
      return (
        '<button type="button" class="event-type-chip' +
        (index === 0 ? ' is-active' : '') +
        '" data-type="' +
        escapeHtml(chip.id) +
        '" aria-pressed="' +
        (index === 0 ? 'true' : 'false') +
        '">' +
        escapeHtml(chip.label) +
        ' <span class="event-type-chip-count">(0)</span></button>'
      );
    }).join('');
    els.typeChipsRoot.querySelectorAll('.event-type-chip[data-type]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        toggleType(chip.getAttribute('data-type') || 'all');
        applyFilters();
      });
    });
    updateTypeChipCounts();
  }

  function updateTypeChipCounts() {
    if (!els.typeChipsRoot) return;
    els.typeChipsRoot.querySelectorAll('.event-type-chip[data-type]').forEach(function (chip) {
      var type = chip.getAttribute('data-type') || 'all';
      var countEl = chip.querySelector('.event-type-chip-count');
      if (!countEl) return;
      var n =
        type === 'all'
          ? allListings.length
          : countBy(function (item) {
              return hasTag(item, type);
            });
      countEl.textContent = '(' + n + ')';
    });
  }

  function syncCategorySelect() {
    if (!els.filterCategory) return;
    els.filterCategory.value = activeCategory || '';
  }

  function renderListings() {
    if (!els.mount) return;

    var filtered = sortListings(getFilteredList());
    var listingsBlock = document.getElementById('listings-view');
    if (listingsBlock) listingsBlock.hidden = viewMode === 'map';

    if (viewMode === 'map') {
      updateResultsCount(filtered.length);
      if (window.hubRefreshOpportunitiesMap) window.hubRefreshOpportunitiesMap(filtered);
      return;
    }

    if (!filtered.length) {
      disconnectLazyObserver();
      els.mount.innerHTML =
        '<div class="events-empty" role="status"><p>No opportunities match your filters. <button type="button" class="clear-filters-link" id="opp-clear-filters">Clear filters</button></p></div>';
      updateResultsCount(0);
      updateTypeChipCounts();
      bindClearFilters();
      return;
    }

    var slice = getListingSlice(filtered);

    els.mount.innerHTML =
      listingsRangeHtml(slice.rangeStart, slice.rangeEnd, filtered.length) +
      '<div class="event-grid">' +
      slice.items.map(gridCard).join('') +
      '</div>' +
      (slice.hasMore ? loadMoreHtml(filtered, slice.rangeEnd) : '') +
      paginationHtml(currentPage, slice.totalPages);

    lastRenderedCount = slice.rangeEnd;
    updateResultsCount(filtered.length);
    updateTypeChipCounts();
    if (saves) saves.refreshButtons(els.mount);
    if (slice.hasMore) observeLazySentinel();
    else disconnectLazyObserver();
    restoreExpandedCard();
  }

  function bindClearFilters() {
    var btn = document.getElementById('opp-clear-filters');
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', resetFilters);
  }

  function readInvestRange() {
    minInvest = els.minInvest && els.minInvest.value !== '' ? Number(els.minInvest.value) : null;
    maxInvest = els.maxInvest && els.maxInvest.value !== '' ? Number(els.maxInvest.value) : null;
    if (minInvest != null && isNaN(minInvest)) minInvest = null;
    if (maxInvest != null && isNaN(maxInvest)) maxInvest = null;
  }

  function readFiltersFromControls() {
    searchQ = els.search ? String(els.search.value || '').trim().toLowerCase() : '';
    sortBy = els.sort ? els.sort.value : 'recommended';
    locationQ = els.postcode ? String(els.postcode.value || '').trim().toLowerCase() : '';
    activeCategory = els.filterCategory ? String(els.filterCategory.value || '').trim() : '';
    readInvestRange();
  }

  function syncInvestPills() {
    document.querySelectorAll('input[data-invest-tier]').forEach(function (input) {
      var tier = input.getAttribute('data-invest-tier') || 'all';
      input.checked = tier === activeInvestTier;
    });
  }

  function syncCommitmentChecks() {
    document.querySelectorAll('[data-commitment]').forEach(function (input) {
      var id = input.getAttribute('data-commitment');
      input.checked = activeCommitments.indexOf(id) !== -1;
    });
  }

  function currentFilterCriteria() {
    return {
      type: activeTypes.length === 1 ? activeTypes[0] : activeTypes.length ? activeTypes.join(',') : 'all',
      category: activeCategory || '',
      invest: activeInvestTier === 'all' ? '' : activeInvestTier,
      location: activeLocationTag || '',
      commitment: activeCommitments.length === 1 ? activeCommitments[0] : activeCommitments.join(','),
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
    activeTypes = type && TAB_TYPES.indexOf(type) !== -1 && type !== 'all' ? [type] : [];

    activeCategory = params.get('category') || '';
    searchQ = String(params.get('q') || '').trim().toLowerCase();
    sortBy = params.get('sort') || 'recommended';
    activeInvestTier = params.get('invest') || 'all';
    activeLocationTag = params.get('location') || '';
    var commitment = params.get('commitment') || '';
    activeCommitments = commitment ? commitment.split(',').filter(Boolean) : [];

    if (els.search && searchQ) els.search.value = searchQ;
    if (els.sort) els.sort.value = sortBy;
    if (els.filterCategory && activeCategory) els.filterCategory.value = activeCategory;
    if (params.get('location') === 'remote' && els.postcode && !params.get('q')) {
      els.postcode.value = 'Remote';
    }

    var viewParam = params.get('view');
    viewMode = viewParam ? normalizeViewMode(viewParam) : loadStoredViewMode();
    if (viewMode === 'list') viewMode = 'grid';

    var min = params.get('min');
    var max = params.get('max');
    minInvest = min !== null && min !== '' ? parseInt(min, 10) : null;
    maxInvest = max !== null && max !== '' ? parseInt(max, 10) : null;
    if (isNaN(minInvest)) minInvest = null;
    if (isNaN(maxInvest)) maxInvest = null;
    if (els.minInvest && minInvest != null) els.minInvest.value = String(minInvest);
    if (els.maxInvest && maxInvest != null) els.maxInvest.value = String(maxInvest);
    if (hasCustomInvestRange()) activeInvestTier = 'all';

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
    if (c.type && c.type !== 'all') params.set('type', c.type.split(',')[0]);
    if (c.category) params.set('category', c.category);
    if (c.invest) params.set('invest', c.invest);
    if (c.location) params.set('location', c.location);
    if (c.commitment) params.set('commitment', c.commitment);
    if (c.q) params.set('q', c.q);
    if (c.sort && c.sort !== 'recommended') params.set('sort', c.sort);
    if (c.minInvest !== '' && c.minInvest != null) params.set('min', String(c.minInvest));
    if (c.maxInvest !== '' && c.maxInvest != null) params.set('max', String(c.maxInvest));
    if (activeCitySlug) params.set('city', activeCitySlug);
    if (viewMode && viewMode !== DEFAULT_VIEW_MODE) params.set('view', viewMode);

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
    readFiltersFromControls();
    syncCategorySelect();
    syncTypeChipUi();
    syncInvestPills();
    syncCommitmentChecks();
    resetListingPagination();
    writeFiltersToUrl();
    renderListings();
    renderSpotlight();
  }

  function resetFilters() {
    var regional = window.hubOppRegionalLanding;
    if (
      regional &&
      regional.slug &&
      !searchQ &&
      !activeCategory &&
      !activeTypes.length &&
      activeInvestTier === 'all' &&
      !activeCommitments.length &&
      !activeLocationTag
    ) {
      var hasExtra = minInvest !== null || maxInvest !== null || locationQ;
      if (!hasExtra) {
        window.location.href = '/opportunities/';
        return;
      }
    }

    activeTypes = [];
    activeInvestTier = 'all';
    activeCategory = '';
    activeCommitments = [];
    activeLocationTag = '';
    locationQ = '';
    searchQ = '';
    sortBy = 'recommended';
    minInvest = null;
    maxInvest = null;
    resetListingPagination();

    if (els.search) els.search.value = '';
    if (els.sort) els.sort.value = 'recommended';
    if (els.postcode) els.postcode.value = '';
    if (els.minInvest) els.minInvest.value = '';
    if (els.maxInvest) els.maxInvest.value = '';
    if (els.filterCategory) els.filterCategory.value = '';

    syncTypeChipUi();
    syncCategorySelect();
    syncInvestPills();
    syncCommitmentChecks();
    writeFiltersToUrl();
    renderListings();
    renderSpotlight();
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
            '/register?return=' + encodeURIComponent(window.location.pathname + window.location.search);
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

  function initSearch() {
    if (!els.search) return;

    els.search.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(applyFilters, SEARCH_DEBOUNCE_MS);
    });
  }

  function initSort() {
    if (!els.sort || els.sort.dataset.bound) return;
    els.sort.dataset.bound = '1';
    els.sort.addEventListener('change', applyFilters);
  }

  function syncViewToggleUI() {
    if (els.viewGrid) {
      els.viewGrid.classList.toggle('is-active', viewMode === 'grid');
      els.viewGrid.setAttribute('aria-pressed', viewMode === 'grid' ? 'true' : 'false');
    }
    if (els.viewMap) {
      els.viewMap.classList.toggle('is-active', viewMode === 'map');
      els.viewMap.setAttribute('aria-pressed', viewMode === 'map' ? 'true' : 'false');
    }
  }

  function initViewToggle() {
    function setView(mode) {
      var wasMap = viewMode === 'map';
      viewMode = normalizeViewMode(mode);
      if (viewMode === 'list') viewMode = 'grid';
      saveViewMode(viewMode);
      syncViewToggleUI();
      if (mode === 'map') {
        if (window.hubSetOppMapView) window.hubSetOppMapView(true);
        renderListings();
        return;
      }
      if (wasMap && window.hubSetOppMapView) window.hubSetOppMapView(false);
      renderListings();
    }

    if (els.viewGrid) {
      els.viewGrid.addEventListener('click', function () {
        setView('grid');
      });
    }
    if (els.viewMap) {
      els.viewMap.addEventListener('click', function () {
        setView('map');
      });
    }
    syncViewToggleUI();
  }

  function initFilterBar() {
    rememberFilterOptionLabels();
    buildTypeChips();

    document.querySelectorAll('input[data-invest-tier]').forEach(function (input) {
      input.addEventListener('change', function () {
        if (!input.checked) return;
        activeInvestTier = input.getAttribute('data-invest-tier') || 'all';
        if (els.minInvest) els.minInvest.value = '';
        if (els.maxInvest) els.maxInvest.value = '';
        minInvest = null;
        maxInvest = null;
        syncInvestPills();
        applyFilters();
      });
    });

    document.querySelectorAll('[data-commitment]').forEach(function (input) {
      input.addEventListener('change', function () {
        var id = input.getAttribute('data-commitment');
        var idx = activeCommitments.indexOf(id);
        if (input.checked && idx === -1) activeCommitments.push(id);
        if (!input.checked && idx !== -1) activeCommitments.splice(idx, 1);
        applyFilters();
      });
    });

    if (els.filterCategory) {
      els.filterCategory.addEventListener('change', applyFilters);
    }
    if (els.postcode) {
      els.postcode.addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(applyFilters, SEARCH_DEBOUNCE_MS);
      });
    }
    [els.minInvest, els.maxInvest].forEach(function (input) {
      if (!input) return;
      input.addEventListener('change', function () {
        if (input.value !== '') activeInvestTier = 'all';
        syncInvestPills();
        applyFilters();
      });
    });

    if (els.moreToggle && els.morePanel) {
      els.moreToggle.addEventListener('click', function () {
        var open = els.morePanel.hasAttribute('hidden');
        if (open) els.morePanel.removeAttribute('hidden');
        else els.morePanel.setAttribute('hidden', '');
        els.moreToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }

    if (els.clearBar) els.clearBar.addEventListener('click', resetFilters);
    if (els.clearResults) els.clearResults.addEventListener('click', resetFilters);
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

      var btn = e.target.closest('.page-btn');
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
      var block = document.getElementById('listings-view');
      if (block) block.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function bootListings(listings) {
    allListings = listings || [];
    updateFilterCounts();
    syncTypeChipUi();
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
    initFilterBar();
    initSearch();
    initSort();
    initViewToggle();
    initPagination();
    bindCardExpand();
    initFavClicks();
    initCopyLink();
    initSaveSearch();
    initHubertStrip();
    syncTypeChipUi();
    syncInvestPills();
    syncCommitmentChecks();
    syncCategorySelect();
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
