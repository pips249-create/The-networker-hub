/**
 * Full-page mobile filter sheet — shared by events and opportunities browse.
 */
(function (global) {
  if (global.HUB_initMobileFilterSheet) return;
  function initMobileFilterSheet(options) {
    options = options || {};
    var shell =
      typeof options.shell === 'string'
        ? document.querySelector(options.shell)
        : options.shell || document.querySelector('.events-filter-shell');
    var toggle =
      typeof options.toggle === 'string'
        ? document.getElementById(options.toggle)
        : options.toggle || document.getElementById('filter-mobile-toggle');
    var badge =
      typeof options.badge === 'string'
        ? document.getElementById(options.badge)
        : options.badge || document.getElementById('filter-mobile-toggle-badge');
    var sheet =
      typeof options.sheet === 'string'
        ? document.getElementById(options.sheet)
        : options.sheet || document.getElementById('filter-mobile-sheet');
    var sheetBody =
      typeof options.sheetBody === 'string'
        ? document.getElementById(options.sheetBody)
        : options.sheetBody || document.getElementById('filter-mobile-sheet-body');
    var sheetBackdrop =
      typeof options.sheetBackdrop === 'string'
        ? document.getElementById(options.sheetBackdrop)
        : options.sheetBackdrop || document.getElementById('filter-mobile-sheet-backdrop');
    var sheetClose =
      typeof options.sheetClose === 'string'
        ? document.getElementById(options.sheetClose)
        : options.sheetClose || document.getElementById('filter-mobile-sheet-close');
    var sheetClear =
      typeof options.sheetClear === 'string'
        ? document.getElementById(options.sheetClear)
        : options.sheetClear || document.getElementById('filter-mobile-sheet-clear');
    var sheetApply =
      typeof options.sheetApply === 'string'
        ? document.getElementById(options.sheetApply)
        : options.sheetApply || document.getElementById('filter-mobile-sheet-apply');
    var sheetTitle =
      typeof options.sheetTitleEl === 'string'
        ? document.getElementById(options.sheetTitleEl)
        : options.sheetTitleEl || document.getElementById('filter-mobile-sheet-title');
    var filterBar =
      typeof options.filterBar === 'string'
        ? document.querySelector(options.filterBar)
        : options.filterBar || document.querySelector('.events-filter-bar');
    var rowTop =
      typeof options.rowTop === 'string'
        ? document.querySelector(options.rowTop)
        : options.rowTop || document.querySelector('.filter-bar-row-top');
    var locationGroup =
      typeof options.locationGroup === 'string'
        ? document.querySelector(options.locationGroup)
        : options.locationGroup || document.querySelector('.filter-bar-location-group');
    var advanced =
      typeof options.advanced === 'string'
        ? document.getElementById(options.advanced)
        : options.advanced || document.getElementById('filter-bar-advanced');
    var inboxTitle =
      typeof options.inboxTitle === 'string'
        ? document.getElementById(options.inboxTitle)
        : options.inboxTitle || document.getElementById('events-filter-inbox-heading');

    if (!shell || !toggle || !sheet || !sheetBody || !filterBar || !advanced || toggle.dataset.bound) {
      return null;
    }
    toggle.dataset.bound = '1';

    /* Escape .shell (position:relative; z-index:2) so fixed overlay sits above .site-nav */
    if (sheet.parentNode !== document.body) {
      document.body.appendChild(sheet);
    }

    var mq = window.matchMedia(options.mediaQuery || '(max-width: 900px)');
    var sheetOpen = false;
    var lastFocus = null;
    var bodyClass = options.bodyClass || 'events-filter-sheet-open';

    var desktopAnchors = {
      locationParent: rowTop,
      locationNext: toggle,
      advancedParent: filterBar,
      inboxParent: filterBar,
      inboxNext: rowTop,
    };

    var getTitle =
      typeof options.getTitle === 'function'
        ? options.getTitle
        : function () {
            return options.title || 'Filters';
          };

    var hasActive =
      typeof options.hasActiveFilters === 'function'
        ? options.hasActiveFilters
        : function () {
            return false;
          };

    var onApply =
      typeof options.onApply === 'function'
        ? options.onApply
        : function () {};

    var onClear =
      typeof options.onClear === 'function'
        ? options.onClear
        : function () {};

    var getApplyLabel =
      typeof options.getApplyLabel === 'function'
        ? options.getApplyLabel
        : function () {
            return options.applyLabel || 'Show results';
          };

    function syncSheetTitle() {
      if (!sheetTitle) return;
      sheetTitle.textContent = getTitle();
    }

    function syncApplyLabel() {
      if (!sheetApply) return;
      sheetApply.textContent = getApplyLabel() || 'Show results';
    }

    function mountSheetContent() {
      syncSheetTitle();
      syncApplyLabel();
      if (inboxTitle && inboxTitle.parentNode !== sheetBody) {
        sheetBody.appendChild(inboxTitle);
      }
      if (locationGroup && locationGroup.parentNode !== sheetBody) {
        sheetBody.appendChild(locationGroup);
      }
      if (advanced && advanced.parentNode !== sheetBody) {
        sheetBody.appendChild(advanced);
      }
    }

    function restoreDesktopContent() {
      if (inboxTitle && desktopAnchors.inboxParent) {
        desktopAnchors.inboxParent.insertBefore(inboxTitle, desktopAnchors.inboxNext);
      }
      if (locationGroup && desktopAnchors.locationParent) {
        desktopAnchors.locationParent.insertBefore(locationGroup, desktopAnchors.locationNext);
      }
      if (advanced && desktopAnchors.advancedParent) {
        desktopAnchors.advancedParent.appendChild(advanced);
      }
    }

    function setSheetOpen(open) {
      sheetOpen = open;
      shell.classList.toggle('is-filter-sheet-open', open);
      document.body.classList.toggle(bodyClass, open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      sheet.hidden = !open;
      sheet.setAttribute('aria-hidden', open ? 'false' : 'true');
      if ('inert' in sheet) sheet.inert = !open;
      if (open) {
        lastFocus = document.activeElement;
        mountSheetContent();
        if (sheetClose) sheetClose.focus();
      } else if (lastFocus && typeof lastFocus.focus === 'function') {
        lastFocus.focus();
        lastFocus = null;
      }
    }

    function openSheet() {
      if (!mq.matches) return;
      mountSheetContent();
      setSheetOpen(true);
    }

    function closeSheet() {
      setSheetOpen(false);
    }

    function syncMobileFilterToggle() {
      var mobile = mq.matches;
      toggle.hidden = !mobile;
      if (!mobile) {
        closeSheet();
        restoreDesktopContent();
        toggle.classList.remove('is-active-hint');
        if (badge) badge.hidden = true;
        return;
      }

      mountSheetContent();
      var active = hasActive();
      toggle.classList.toggle('is-active-hint', active);
      if (badge) {
        badge.hidden = !active;
        badge.textContent = active ? '•' : '';
      }
      if (sheetOpen) {
        syncSheetTitle();
        syncApplyLabel();
      } else {
        sheet.setAttribute('aria-hidden', 'true');
        if ('inert' in sheet) sheet.inert = true;
      }
    }

    toggle.addEventListener('click', function () {
      if (sheetOpen) closeSheet();
      else openSheet();
    });

    if (sheetBackdrop) sheetBackdrop.addEventListener('click', closeSheet);
    if (sheetClose) sheetClose.addEventListener('click', closeSheet);
    if (sheetApply) {
      sheetApply.addEventListener('click', function () {
        onApply();
        closeSheet();
      });
    }
    if (sheetClear) {
      sheetClear.addEventListener('click', function () {
        onClear();
        syncMobileFilterToggle();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sheetOpen) {
        e.preventDefault();
        closeSheet();
      }
    });

    if (mq.addEventListener) mq.addEventListener('change', syncMobileFilterToggle);
    else if (mq.addListener) mq.addListener(syncMobileFilterToggle);

    syncMobileFilterToggle();

    return {
      sync: syncMobileFilterToggle,
      open: openSheet,
      close: closeSheet,
    };
  }

  global.HUB_initMobileFilterSheet = initMobileFilterSheet;
})(typeof window !== 'undefined' ? window : globalThis);

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
    { id: 'all', label: 'All', shortLabel: 'All' },
    { id: 'franchise', label: 'Franchise', shortLabel: 'Franchise' },
    { id: 'side-hustle', label: 'Side hustle', shortLabel: 'Side hustle' },
    { id: 'partnership', label: 'Partnership', shortLabel: 'Partnership' },
    { id: 'affiliate', label: 'Affiliate', shortLabel: 'Affiliate' },
    { id: 'networking', label: 'Ambassador', shortLabel: 'Ambassador' },
    { id: 'network-marketing', label: 'Network marketing', shortLabel: 'Net. marketing' },
    { id: 'business-opportunity', label: 'Business', shortLabel: 'Business' },
    { id: 'distributorship', label: 'Distribution', shortLabel: 'Distribution' },
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
    'affiliate',
    'networking',
    'network-marketing',
    'business-opportunity',
    'distributorship',
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
  var spotlightRenderKey = '';
  var spotlightAnimating = false;
  var spotlightCarouselBound = false;
  var pendingResultsScroll = false;
  var activeCitySlug = '';
  var activeCityName = '';
  var applyFiltersToken = 0;

  var INDUSTRY_CHIPS = (
    catalog && catalog.CATEGORY_OPTIONS
      ? catalog.CATEGORY_OPTIONS
      : [
          { id: 'cleaning', label: 'Cleaning' },
          { id: 'food', label: 'Food & Drink' },
          { id: 'tech', label: 'Tech & Digital' },
          { id: 'health', label: 'Health & Fitness' },
          { id: 'beauty', label: 'Beauty & Wellness' },
          { id: 'property', label: 'Property' },
          { id: 'education', label: 'Education & Coaching' },
          { id: 'finance', label: 'Finance & Admin' },
          { id: 'pets', label: 'Pets & Animals' },
        ]
  )
    .filter(function (opt) {
      return opt.id !== 'mlm' && opt.id !== 'general';
    })
    .map(function (opt) {
      var shortById = {
        food: 'Food',
        tech: 'Tech',
        health: 'Health',
        beauty: 'Beauty',
        education: 'Education',
        finance: 'Finance',
        pets: 'Pets',
      };
      return {
        id: opt.id,
        label: opt.label,
        shortLabel: shortById[opt.id] || opt.label,
      };
    });

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
    els.industryChipsRoot = document.getElementById('opp-industry-chips');
    els.minInvest = document.getElementById('opp-min-invest');
    els.maxInvest = document.getElementById('opp-max-invest');
    els.filterCategory = document.getElementById('opp-filter-category');
    els.moreToggle = document.getElementById('filter-more-toggle');
    els.morePanel = document.getElementById('filter-more-panel');
    els.moreBadge = document.getElementById('filter-more-badge');
    els.clearBar = document.getElementById('clear-filters-bar');
    els.activeFiltersBar = document.getElementById('opp-active-filters-bar');
    els.activeFilters = document.getElementById('opp-active-filters');
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

  function dedupeListingsById(list) {
    var seen = {};
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var id = String(list[i].id || '');
      if (!id || seen[id]) continue;
      seen[id] = true;
      out.push(list[i]);
    }
    return out;
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
      var featured = dedupeListingsById(
        allListings.filter(function (item) {
          return item.featured && !isNetworkMarketingListing(item);
        })
      ).slice(0, SPOTLIGHT_MAX);
      spotlightFeaturedOrder = shuffleList(featured);
    }
    return spotlightFeaturedOrder;
  }

  function getSpotlightVisible() {
    return getSpotlightFeatured().filter(matchesFilter);
  }

  function getGridListings() {
    /* Match events browse: featured items stay in the main grid as well as spotlight.
       Hiding them from the grid made a Featured-only catalogue look empty. */
    return getFilteredList();
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
    var featured = getSpotlightVisible();
    if (!sc || !track || !featured.length) return 0;
    return sc.measureLoopWidth(track, featured.length, '.opp-premium-card');
  }

  function syncSpotlightLoopScroll() {
    var sc = window.HubSpotlightCarousel;
    var track = els.spotlightTrack;
    if (!sc || !track) return;
    var featured = getSpotlightVisible();
    var loopWidth = measureSpotlightLoopWidth();
    sc.syncLoopScroll(track, loopWidth, featured.length, '.opp-premium-card');
  }

  function layoutSpotlightTrack(cardsHtml, itemCount) {
    if (!els.spotlightTrack) return;
    var sc = window.HubSpotlightCarousel;
    if (!sc || typeof sc.applyLoopLayout !== 'function') {
      els.spotlightTrack.innerHTML = cardsHtml || '';
      return;
    }
    var section = els.spotlightSection || els.spotlightTrack.closest('.premium-spotlight');
    sc.applyLoopLayout(els.spotlightTrack, section, itemCount, '.opp-premium-card', cardsHtml);
  }

  function refreshSpotlightLayout() {
    var featured = getSpotlightVisible();
    var track = els.spotlightTrack;
    if (!track || !featured.length) return;
    var sc = window.HubSpotlightCarousel;
    var section = els.spotlightSection || track.closest('.premium-spotlight');
    /* Mobile chrome resize must not rewrite the track — that flickers premium cards. */
    if (track.children.length && sc && typeof sc.remeasureLayout === 'function') {
      var wasLooping = sc.isLooping(track);
      var prefersSimple = window.matchMedia('(hover: none), (max-width: 768px)').matches;
      if (wasLooping && prefersSimple) {
        layoutSpotlightTrack(featured.map(premiumSpotlightCard).join(''), featured.length);
      } else {
        sc.remeasureLayout(track, section, featured.length, '.opp-premium-card');
      }
      syncSpotlightLoopScroll();
      return;
    }
    layoutSpotlightTrack(featured.map(premiumSpotlightCard).join(''), featured.length);
    syncSpotlightLoopScroll();
    startSpotlightAuto();
  }

  function advanceSpotlight(dir) {
    dir = dir < 0 ? -1 : 1;
    var featured = getSpotlightVisible();
    var track = els.spotlightTrack;
    var sc = window.HubSpotlightCarousel;
    if (!featured.length || featured.length <= 1 || !track || spotlightAnimating) return;

    spotlightAnimating = true;
    stopSpotlightAuto();

    var step = getSpotlightCardStep() * dir;
    var looping = sc && sc.isLooping(track);
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var behavior = reduceMotion ? 'auto' : 'smooth';

    function finishAdvance() {
      syncSpotlightLoopScroll();
      spotlightAnimating = false;
      startSpotlightAuto();
    }

    if (looping && sc) {
      var loopWidth =
        parseFloat(track.dataset.loopWidth) ||
        sc.measureLoopWidth(track, featured.length, '.opp-premium-card');
      if (
        !sc.advanceLoop(track, dir, step, behavior, loopWidth, featured.length, '.opp-premium-card')
      ) {
        sc.advanceNonLoop(track, dir, step, behavior);
      }
    } else if (sc) {
      sc.advanceNonLoop(track, dir, step, behavior);
    } else {
      track.scrollBy({ left: step, behavior: behavior });
    }

    window.setTimeout(finishAdvance, reduceMotion ? 0 : 380);
  }

  function startSpotlightAuto() {
    stopSpotlightAuto();
    if (window.matchMedia('(hover: none), (max-width: 768px)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var sc = window.HubSpotlightCarousel;
    if (!els.spotlightTrack || !sc || !sc.canAutoAdvance(els.spotlightTrack, getSpotlightVisible().length)) return;
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
    return moneyFieldLabel(item) + ' · ' + investmentLabel(item);
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

  function renderSpotlight() {
    if (!els.spotlightTrack) return;

    var featured = getSpotlightVisible();
    var promo =
      document.getElementById('opp-promo-section') ||
      document.querySelector('.opp-promo-section');

    if (!featured.length) {
      stopSpotlightAuto();
      if (window.HubSpotlightCarousel && window.HubSpotlightCarousel.clearTrack) {
        window.HubSpotlightCarousel.clearTrack(els.spotlightTrack);
      } else {
        els.spotlightTrack.innerHTML = '';
        els.spotlightTrack.removeAttribute('data-loop-width');
        els.spotlightTrack.removeAttribute('data-spotlight-content-key');
      }
      els.spotlightTrack.classList.remove('spotlight-track--carousel');
      els.spotlightTrack.scrollLeft = 0;
      spotlightRenderKey = '';
      if (promo) promo.hidden = true;
      return;
    }

    var cardsHtml = featured.map(premiumSpotlightCard).join('');
    var renderKey =
      featured.length +
      ':' +
      featured
        .map(function (item) {
          return item.id || '';
        })
        .join(',');
    if (renderKey === spotlightRenderKey && els.spotlightTrack.children.length) {
      if (promo) promo.hidden = false;
      return;
    }
    spotlightRenderKey = renderKey;
    els.spotlightTrack.classList.add('spotlight-track--carousel');
    if (promo) promo.hidden = false;
    bindSpotlightCarousel();
    /* Paint once — skip rAF second layout that caused mobile flicker. */
    layoutSpotlightTrack(cardsHtml, featured.length);
    syncSpotlightLoopScroll();
    startSpotlightAuto();
  }

  function syncClearFiltersVisibility() {
    var active = hasActiveOppMobileFilters();
    if (els.clearBar) {
      els.clearBar.hidden = !active;
    }
  }

  function removeActiveFilter(key, value) {
    if (key === 'type') {
      activeTypes = activeTypes.filter(function (t) {
        return t !== value;
      });
    } else if (key === 'category') {
      activeCategory = '';
      if (els.filterCategory) els.filterCategory.value = '';
    } else if (key === 'invest') {
      activeInvestTier = 'all';
    } else if (key === 'minInvest') {
      minInvest = null;
      if (els.minInvest) els.minInvest.value = '';
    } else if (key === 'maxInvest') {
      maxInvest = null;
      if (els.maxInvest) els.maxInvest.value = '';
    } else if (key === 'commitment') {
      activeCommitments = activeCommitments.filter(function (c) {
        return c !== value;
      });
    } else if (key === 'location') {
      var wasRemote = activeLocationTag === 'remote';
      activeLocationTag = '';
      if (wasRemote && els.postcode && /^remote$/i.test(els.postcode.value || '')) {
        els.postcode.value = '';
        locationQ = '';
      }
    } else if (key === 'locationQuery') {
      locationQ = '';
      activeLocationTag = '';
      if (els.postcode) els.postcode.value = '';
    } else if (key === 'q') {
      searchQ = '';
      if (els.search) els.search.value = '';
    }
    syncTypeChipUi();
    syncCategorySelect();
    syncInvestPills();
    syncCommitmentChecks();
    applyFilters();
  }

  function renderActiveFilters() {
    if (!els.activeFilters || !els.activeFiltersBar) return;
    var chips = alertSummaryChips(currentFilterCriteria());
    if (!chips.length) {
      els.activeFilters.innerHTML = '';
      els.activeFiltersBar.hidden = true;
      return;
    }
    els.activeFiltersBar.hidden = false;
    els.activeFilters.innerHTML = chips
      .map(function (chip) {
        return (
          '<li><button type="button" class="opp-active-filter-chip" data-filter-key="' +
          escapeHtml(chip.key) +
          '" data-filter-value="' +
          escapeHtml(chip.value) +
          '" aria-label="Remove filter ' +
          escapeHtml(chip.label) +
          '">' +
          escapeHtml(chip.label) +
          '<span class="opp-active-filter-chip-x" aria-hidden="true">×</span>' +
          '</button></li>'
        );
      })
      .join('');
  }

  function bindActiveFilters() {
    if (!els.activeFilters || els.activeFilters.dataset.bound) return;
    els.activeFilters.dataset.bound = '1';
    els.activeFilters.addEventListener('click', function (e) {
      var btn = e.target.closest('.opp-active-filter-chip');
      if (!btn) return;
      removeActiveFilter(btn.getAttribute('data-filter-key') || '', btn.getAttribute('data-filter-value') || '');
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

  function isAffiliateMoney(item) {
    return !!(catalog && catalog.isAffiliateStyleListing && catalog.isAffiliateStyleListing(item));
  }

  function moneyFieldLabel(item) {
    return isAffiliateMoney(item) ? 'Commission' : 'Investment';
  }

  function formatMoneyDisplay(key, raw) {
    var val = String(raw || '').trim();
    if (!val || /^enquire$/i.test(val) || val === '—') return 'On request';
    if (catalog && catalog.formatMetaDisplayValue) {
      return catalog.formatMetaDisplayValue(key, val) || val;
    }
    if (/^£/.test(val) || /%/.test(val)) return val;
    if (/\d/.test(val) && /^investment/i.test(key || '')) return '£' + val;
    return val;
  }

  function investmentLabel(item) {
    if (isAffiliateMoney(item)) {
      var commission = '';
      (item.meta || []).forEach(function (m) {
        if (/^commission$/i.test(m.key) && m.val) commission = String(m.val).trim();
      });
      if (commission) return formatMoneyDisplay('Commission', commission);
      return 'On request';
    }
    if (catalog && catalog.cardDisplayMeta) {
      var meta = catalog.cardDisplayMeta(item);
      for (var i = 0; i < meta.length; i++) {
        if (/investment/i.test(meta[i].key) && meta[i].val) {
          return formatMoneyDisplay(meta[i].key, meta[i].val);
        }
      }
    }
    if (item.investAmount != null && !isNaN(item.investAmount)) {
      if (item.investAmount <= 0) return 'On request';
      if (item.investAmount >= 1000) {
        var rounded = Math.round(item.investAmount / 1000) * 1000;
        return 'From £' + rounded.toLocaleString('en-GB');
      }
      return 'From £' + Number(item.investAmount).toLocaleString('en-GB');
    }
    return 'On request';
  }

  function moneyPriceHtml(item) {
    return (
      '<span class="event-grid-price">' +
      '<span class="event-grid-price-value">' +
      escapeHtml(investmentLabel(item)) +
      '</span>' +
      '<span class="event-grid-price-label">' +
      escapeHtml(moneyFieldLabel(item)) +
      '</span></span>'
    );
  }

  function hostsAreNearDuplicate(title, host) {
    var a = String(title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    var b = String(host || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.indexOf(b) !== -1 || b.indexOf(a) !== -1) return true;
    var aTokens = a.split(/\s+/).filter(Boolean);
    var bTokens = b.split(/\s+/).filter(Boolean);
    if (!aTokens.length || !bTokens.length) return false;
    var shared = 0;
    for (var i = 0; i < bTokens.length; i++) {
      if (aTokens.indexOf(bTokens[i]) !== -1) shared += 1;
    }
    return shared >= Math.min(2, bTokens.length) && shared / bTokens.length >= 0.6;
  }

  function isLogoCoverImage(item) {
    var imageUrl = String((item && item.imageUrl) || '').trim();
    var logoUrl = String((item && item.logoUrl) || '').trim();
    if (!imageUrl) return false;
    if (logoUrl && imageUrl === logoUrl) return true;
    if (/\/opportunities\/logos\//i.test(imageUrl)) return true;
    if (/\.svg(?:$|\?)/i.test(imageUrl) && /logo/i.test(imageUrl)) return true;
    return false;
  }

  function commitmentLabel(item) {
    var tags = item.filterTags || [];
    for (var i = 0; i < COMMITMENTS.length; i++) {
      if (tags.indexOf(COMMITMENTS[i].id) !== -1) return COMMITMENTS[i].label;
    }
    return 'Flexible';
  }

  function commitmentClass(item) {
    var tags = item.filterTags || [];
    for (var i = 0; i < COMMITMENTS.length; i++) {
      if (tags.indexOf(COMMITMENTS[i].id) !== -1) return 'commitment-' + COMMITMENTS[i].id;
    }
    return 'commitment-flexible';
  }

  function mediaHtml(item, thumb) {
    if (item.imageUrl) {
      var logoClass = isLogoCoverImage(item) ? ' is-logo-cover' : '';
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
      '<span aria-hidden="true">' +
      (thumb.emoji || '✦') +
      '</span></div>'
    );
  }

  function matchesLocation(item) {
    if (activeLocationTag && !hasTag(item, activeLocationTag)) return false;
    if (!locationQ) return true;
    var hay = [item.locationLabel, item.searchText, item.title, item.host, (item.tags || []).join(' ')]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (window.HubSearchMatch && typeof window.HubSearchMatch.haystackMatchesQuery === 'function') {
      return window.HubSearchMatch.haystackMatchesQuery(hay, locationQ);
    }
    var terms = locationQ.split(/\s+/).filter(Boolean);
    for (var i = 0; i < terms.length; i++) {
      if (hay.indexOf(terms[i]) === -1) return false;
    }
    return true;
  }

  function hasKnownInvestment(item) {
    return item && item.investAmount != null && !isNaN(item.investAmount) && item.investAmount > 0;
  }

  function matchesInvestTier(item) {
    if (!activeInvestTier || activeInvestTier === 'all') return true;
    if (activeInvestTier === 'on-request') {
      return !hasKnownInvestment(item) || hasTag(item, 'on-request');
    }
    if (!hasKnownInvestment(item)) return false;
    return hasTag(item, activeInvestTier);
  }

  function matchesCommitments(item) {
    if (!activeCommitments.length) return true;
    for (var i = 0; i < activeCommitments.length; i++) {
      if (hasTag(item, activeCommitments[i])) return true;
    }
    return false;
  }

  function isNetworkMarketingListing(item) {
    if (!item) return false;
    if (String(item.type || '') === 'network-marketing') return true;
    var tags = (item.tags || []).concat(item.filterTags || []);
    for (var i = 0; i < tags.length; i++) {
      if (String(tags[i] || '') === 'network-marketing') return true;
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

  function matchesSearchQuery(item) {
    if (!searchQ) return true;
    var hay = String(item && item.searchText ? item.searchText : '').toLowerCase();
    if (window.HubSearchMatch && typeof window.HubSearchMatch.haystackMatchesQuery === 'function') {
      return window.HubSearchMatch.haystackMatchesQuery(hay, searchQ);
    }
    var terms = searchQ.split(/\s+/).filter(Boolean);
    if (!terms.length) return true;
    for (var i = 0; i < terms.length; i++) {
      if (hay.indexOf(terms[i]) === -1) return false;
    }
    return true;
  }

  function matchesCustomInvestRange(item) {
    if (minInvest !== null && (item.investAmount === null || item.investAmount < minInvest)) return false;
    if (maxInvest !== null && (item.investAmount === null || item.investAmount > maxInvest)) return false;
    return true;
  }

  function matchesFilterExcept(item, except) {
    except = except || {};
    if (activeCitySlug && !matchesCityRegion(item)) return false;
    if (!except.type && activeTypes.length && !matchesTypes(item)) return false;
    if (!except.category && activeCategory && item.category !== activeCategory) return false;
    if (!except.invest) {
      if (!matchesInvestTier(item)) return false;
      if (!matchesCustomInvestRange(item)) return false;
    }
    if (!except.commitment && !matchesCommitments(item)) return false;
    if (!except.location && !matchesLocation(item)) return false;
    if (!except.search && !matchesSearchQuery(item)) return false;
    return true;
  }

  function matchesFilter(item) {
    return matchesFilterExcept(item, null);
  }

  function countMatching(predicate, except) {
    return countBy(function (item) {
      return matchesFilterExcept(item, except) && (!predicate || predicate(item));
    });
  }

  function getFilteredList() {
    return allListings.filter(matchesFilter);
  }

  function sortListings(list) {
    var sorted = list.slice();
    sorted.sort(function (a, b) {
      if (sortBy === 'recommended') {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return listingRecency(b) - listingRecency(a);
      }
      if (sortBy === 'newest') {
        return listingRecency(b) - listingRecency(a);
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

  function listingRecency(item) {
    var raw = (item && (item.publishedAt || item.createdAt)) || '';
    var t = Date.parse(raw);
    return Number.isFinite(t) ? t : 0;
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
        n = countMatching(function (item) {
          return item.category === categoryKey;
        }, { category: true });
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

  function gridCard(item) {
    var href = detailHref(item);
    var typeLabels = catalog ? catalog.TYPE_LABELS : {};
    var typeLabel = typeLabels[item.type] || item.type || 'Opportunity';
    var thumb = item.thumb || { emoji: '✦', gradient: 'linear-gradient(135deg,#fdf6e3,#f5e0a0)' };
    var commitment = commitmentLabel(item);
    var locationLabel = item.locationLabel || 'UK';
    var metaLine = escapeHtml(locationLabel);
    if (isAffiliateMoney(item) && catalog && catalog.cookieWindowFromMeta) {
      var cookieVal = catalog.cookieWindowFromMeta(item.meta);
      var cookieShort =
        catalog.affiliateCookieShortLabel && catalog.affiliateCookieShortLabel(cookieVal);
      if (cookieShort) metaLine += ' · ' + escapeHtml(cookieShort);
    }
    var hostLabel = String(item.host || '').trim();
    var titleLabel = String(item.title || '').trim();
    var showHost =
      hostLabel &&
      hostLabel.toLowerCase() !== 'provider' &&
      !hostsAreNearDuplicate(titleLabel, hostLabel);
    var premiumBadge = item.featured ? '<span class="event-grid-premium">Premium</span>' : '';
    var saved = saves && saves.isSaved(item.id);

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
      '</span>' +
      '<button type="button" class="fav-btn opp-fav-btn' +
      (saved ? ' is-active' : '') +
      '" data-opp-id="' +
      escapeHtml(item.id) +
      '" aria-label="' +
      (saved ? 'Remove from saved' : 'Save opportunity') +
      '" aria-pressed="' +
      (saved ? 'true' : 'false') +
      '">' +
      FAV_ICON +
      '</button></div>' +
      '<div class="event-grid-body">' +
      '<div class="event-grid-body-top">' +
      '<span class="event-grid-format ' +
      commitmentClass(item) +
      '">' +
      escapeHtml(commitment) +
      '</span>' +
      moneyPriceHtml(item) +
      '</div>' +
      '<h3 class="event-grid-title">' +
      escapeHtml(item.title) +
      '</h3>' +
      (showHost
        ? '<p class="event-grid-host">' + escapeHtml(hostLabel) + '</p>'
        : '') +
      '<p class="event-grid-meta">' +
      metaLine +
      '</p>' +
      '<div class="bo-opp-card-actions">' +
      '<a class="bo-opp-primary-btn" href="' +
      escapeHtml(href) +
      '">View listing</a>' +
      '<button type="button" class="bo-opp-compare-btn' +
      (window.HubOpportunityCompare && window.HubOpportunityCompare.isSelected(item.id)
        ? ' is-active'
        : '') +
      '" data-opp-compare-id="' +
      escapeHtml(item.id) +
      '" aria-pressed="' +
      (window.HubOpportunityCompare && window.HubOpportunityCompare.isSelected(item.id)
        ? 'true'
        : 'false') +
      '">' +
      (window.HubOpportunityCompare && window.HubOpportunityCompare.isSelected(item.id)
        ? 'Added'
        : 'Compare') +
      '</button>' +
      '</div></div></div>' +
      '<a class="event-grid-card-link" href="' +
      escapeHtml(href) +
      '" aria-label="View ' +
      escapeHtml(item.title) +
      '" tabindex="-1"></a></article>'
    );
  }

  function syncCompareButtons(root) {
    var cmp = window.HubOpportunityCompare;
    if (!cmp) return;
    (root || document).querySelectorAll('[data-opp-compare-id]').forEach(function (btn) {
      var id = btn.getAttribute('data-opp-compare-id');
      var on = cmp.isSelected(id);
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.textContent = on ? 'Added' : 'Compare';
    });
  }

  function ensureCompareTray() {
    var existing = document.getElementById('bo-opp-compare-tray');
    if (existing) return existing;
    var el = document.createElement('div');
    el.id = 'bo-opp-compare-tray';
    el.className = 'bo-opp-compare-tray';
    el.hidden = true;
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Compare opportunities');
    el.innerHTML =
      '<div class="bo-opp-compare-tray-inner">' +
      '<div class="bo-opp-compare-tray-main">' +
      '<p class="bo-opp-compare-tray-text"><strong id="bo-opp-compare-count">0</strong> selected to compare' +
      '<span class="bo-opp-compare-tray-hint">Tap a chip to remove · Exit compare to leave</span></p>' +
      '<div class="bo-opp-compare-tray-chips" id="bo-opp-compare-tray-chips" hidden></div>' +
      '<div class="bo-opp-compare-tray-actions">' +
      '<button type="button" class="bo-opp-compare-tray-clear" id="bo-opp-compare-clear">Exit compare</button>' +
      '<button type="button" class="bo-opp-compare-tray-cta" id="bo-opp-compare-open" disabled>Compare now</button>' +
      '</div></div>' +
      '</div>';
    document.body.appendChild(el);
    return el;
  }

  function compareTitleForId(id) {
    var item = findListingById(id);
    if (item && item.title) return item.title;
    var cmp = window.HubOpportunityCompare;
    if (cmp && cmp.resolveItems && catalog) {
      var resolved = cmp.resolveItems(catalog, [id], allListings);
      if (resolved && resolved[0] && resolved[0].title) return resolved[0].title;
    }
    return 'Listing';
  }

  function renderCompareTrayChips(ids) {
    var chipsEl = document.getElementById('bo-opp-compare-tray-chips');
    if (!chipsEl) return;
    if (!ids.length) {
      chipsEl.innerHTML = '';
      chipsEl.hidden = true;
      return;
    }
    chipsEl.hidden = false;
    chipsEl.innerHTML = ids
      .map(function (id) {
        var title = compareTitleForId(id);
        var short = title.length > 30 ? title.slice(0, 28) + '…' : title;
        return (
          '<button type="button" class="bo-opp-compare-tray-chip" data-opp-compare-remove="' +
          escapeHtml(id) +
          '" title="Remove ' +
          escapeHtml(title) +
          ' from compare">' +
          escapeHtml(short) +
          '<span class="bo-opp-compare-tray-chip-x" aria-hidden="true">×</span></button>'
        );
      })
      .join('');
  }

  function refreshCompareTray() {
    var cmp = window.HubOpportunityCompare;
    var tray = ensureCompareTray();
    if (!cmp || !tray) return;
    var ids = cmp.ids();
    var countEl = document.getElementById('bo-opp-compare-count');
    var openBtn = document.getElementById('bo-opp-compare-open');
    var clearBtn = document.getElementById('bo-opp-compare-clear');
    var hintEl = tray.querySelector('.bo-opp-compare-tray-hint');
    if (countEl) countEl.textContent = String(ids.length);
    if (openBtn) {
      openBtn.disabled = ids.length < 2;
      openBtn.textContent = ids.length < 2 ? 'Pick one more' : 'Compare now';
    }
    if (clearBtn) clearBtn.disabled = !ids.length;
    if (hintEl) {
      hintEl.textContent =
        ids.length < 2
          ? 'Select another listing to compare side by side'
          : 'Tap a chip to remove · Exit compare to leave';
    }
    renderCompareTrayChips(ids);
    tray.hidden = ids.length === 0;
    document.body.classList.toggle('has-opp-compare-tray', ids.length > 0);
    syncCompareButtons(els.mount || document);
    dismissCompareIntro();
  }

  function dismissCompareIntro() {
    var intro = document.getElementById('bo-opp-compare-intro');
    if (intro) intro.remove();
    try {
      sessionStorage.setItem('hubOppCompareIntroSeen', '1');
    } catch (e) {
      /* ignore */
    }
  }

  function maybeShowCompareIntro() {
    var cmp = window.HubOpportunityCompare;
    if (!cmp || cmp.ids().length) return;
    try {
      if (sessionStorage.getItem('hubOppCompareIntroSeen') === '1') return;
    } catch (e) {
      /* ignore */
    }
    if (document.getElementById('bo-opp-compare-intro')) return;
    var el = document.createElement('div');
    el.id = 'bo-opp-compare-intro';
    el.className = 'bo-opp-compare-intro';
    el.setAttribute('role', 'status');
    el.innerHTML =
      '<div class="bo-opp-compare-intro-inner">' +
      '<p class="bo-opp-compare-intro-text"><strong>Compare opportunities</strong> — pick 2 or 3 listings with the Compare button, then open the bar at the bottom.</p>' +
      '<button type="button" class="bo-opp-compare-intro-dismiss" id="bo-opp-compare-intro-dismiss">Got it</button>' +
      '</div>';
    document.body.appendChild(el);
    var dismissBtn = document.getElementById('bo-opp-compare-intro-dismiss');
    if (dismissBtn) dismissBtn.addEventListener('click', dismissCompareIntro);
    window.setTimeout(function () {
      el.classList.add('is-visible');
    }, 20);
  }

  function openBrowseCompare(forceIds) {
    var cmp = window.HubOpportunityCompare;
    if (!cmp || !cmp.openModal) return false;
    if (Array.isArray(forceIds) && forceIds.length && cmp.setIds) {
      cmp.setIds(forceIds);
      refreshCompareTray();
    }
    return cmp.openModal(catalog, cmp.ids(), allListings);
  }

  function bindCompareControls() {
    if (!els.mount || els.mount.dataset.compareBound === '1') return;
    if (!window.HubOpportunityCompare) return;
    els.mount.dataset.compareBound = '1';

    ensureCompareTray();
    refreshCompareTray();
    maybeShowCompareIntro();

    if (document.body.dataset.oppCompareClickBound !== '1') {
      document.body.dataset.oppCompareClickBound = '1';
      document.addEventListener('click', function (e) {
        if (!document.body.classList.contains('opp-browse-page')) return;

        var removeChip = e.target.closest('[data-opp-compare-remove]');
        if (removeChip) {
          e.preventDefault();
          var cmpRemove = window.HubOpportunityCompare;
          var removeId = removeChip.getAttribute('data-opp-compare-remove');
          if (cmpRemove && removeId) {
            cmpRemove.toggle(removeId);
            refreshCompareTray();
          }
          return;
        }

        var btn = e.target.closest('[data-opp-compare-id]');
        if (!btn || !els.mount || !els.mount.contains(btn)) return;
        e.preventDefault();
        e.stopPropagation();
        var cmp = window.HubOpportunityCompare;
        var id = btn.getAttribute('data-opp-compare-id');
        if (!cmp || !id) return;
        if (!cmp.isSelected(id) && cmp.ids().length >= cmp.MAX) {
          btn.blur();
          return;
        }
        var beforeCount = cmp.ids().length;
        cmp.toggle(id);
        refreshCompareTray();
        var afterCount = cmp.ids().length;
        // Open the side-by-side table as soon as 2 listings are selected.
        if (beforeCount < 2 && afterCount >= 2) {
          openBrowseCompare();
        }
      });
    }

    var openBtn = document.getElementById('bo-opp-compare-open');
    var clearBtn = document.getElementById('bo-opp-compare-clear');
    var dismissBtn = document.getElementById('bo-opp-compare-dismiss');
    if (openBtn && openBtn.dataset.bound !== '1') {
      openBtn.dataset.bound = '1';
      openBtn.addEventListener('click', function () {
        openBrowseCompare();
      });
    }
    if (clearBtn && clearBtn.dataset.bound !== '1') {
      clearBtn.dataset.bound = '1';
      clearBtn.addEventListener('click', function () {
        window.HubOpportunityCompare.clear();
        refreshCompareTray();
      });
    }
    if (dismissBtn && dismissBtn.dataset.bound !== '1') {
      dismissBtn.dataset.bound = '1';
      dismissBtn.addEventListener('click', function () {
        window.HubOpportunityCompare.clear();
        refreshCompareTray();
      });
    }

    if (document.body.dataset.oppCompareEscapeBound !== '1') {
      document.body.dataset.oppCompareEscapeBound = '1';
      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        if (document.getElementById('opp-compare-modal')) return;
        var cmp = window.HubOpportunityCompare;
        if (!cmp || !cmp.ids().length) return;
        cmp.clear();
        refreshCompareTray();
      });
      document.addEventListener('hub-opp-compare-closed', function () {
        refreshCompareTray();
      });
    }

    window.HubOpportunityCompareOpenBrowse = openBrowseCompare;
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
    var wrap = els.resultsCount.closest('.events-results-count');
    if (wrap) {
      wrap.innerHTML =
        'Showing <strong id="opp-results-count">' +
        String(total) +
        '</strong> result' +
        (total === 1 ? '' : 's');
      els.resultsCount = document.getElementById('opp-results-count');
    }
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

    var filtered = sortListings(getGridListings());
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
      refreshCompareTray();
      loadingMore = false;
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
    var titles = {
      partnership: 'Business partnership or joint venture',
      affiliate: 'Affiliate programme (commission / promote a product or service)',
      networking: 'Networking group / Ambassador',
      'business-opportunity': 'Business opportunity',
      distributorship: 'Distributorship / Reseller',
      'network-marketing': 'Network marketing',
    };
    els.typeChipsRoot.innerHTML = TYPE_CHIPS.map(function (chip, index) {
      var shortLabel = chip.shortLabel || chip.label;
      var title = titles[chip.id] || chip.label;
      return (
        '<button type="button" class="event-type-chip' +
        (index === 0 ? ' is-active' : '') +
        '" data-type="' +
        escapeHtml(chip.id) +
        '" aria-pressed="' +
        (index === 0 ? 'true' : 'false') +
        '" title="' +
        escapeHtml(title) +
        '">' +
        '<span class="event-type-chip-label-full">' +
        escapeHtml(chip.label) +
        '</span>' +
        '<span class="event-type-chip-label-short">' +
        escapeHtml(shortLabel) +
        '</span>' +
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

  function syncIndustryChipUi() {
    if (!els.industryChipsRoot) return;
    els.industryChipsRoot.querySelectorAll('.event-type-chip[data-category]').forEach(function (chip) {
      var id = chip.getAttribute('data-category') || '';
      var active = id === '' ? !activeCategory : activeCategory === id;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function setIndustry(id) {
    id = String(id || '').trim();
    activeCategory = !id || activeCategory === id ? '' : id;
    syncCategorySelect();
    syncIndustryChipUi();
  }

  function buildIndustryChips() {
    if (!els.industryChipsRoot) return;
    var chips = [{ id: '', label: 'All industries', shortLabel: 'All' }].concat(
      INDUSTRY_CHIPS.map(function (opt) {
        return {
          id: opt.id,
          label: opt.label,
          shortLabel: opt.shortLabel || opt.label,
        };
      })
    );
    els.industryChipsRoot.innerHTML = chips
      .map(function (chip, index) {
        return (
          '<button type="button" class="event-type-chip' +
          (index === 0 ? ' is-active' : '') +
          '" data-category="' +
          escapeHtml(chip.id) +
          '" aria-pressed="' +
          (index === 0 ? 'true' : 'false') +
          '" title="' +
          escapeHtml(chip.label) +
          '">' +
          '<span class="event-type-chip-label-full">' +
          escapeHtml(chip.label) +
          '</span>' +
          '<span class="event-type-chip-label-short">' +
          escapeHtml(chip.shortLabel) +
          '</span>' +
          ' <span class="event-type-chip-count">(0)</span></button>'
        );
      })
      .join('');
    els.industryChipsRoot.querySelectorAll('.event-type-chip[data-category]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        setIndustry(chip.getAttribute('data-category') || '');
        applyFilters();
      });
    });
    updateIndustryChipCounts();
  }

  function visibleListingCountForAllChip() {
    return countMatching(null, { type: true });
  }

  function updateIndustryChipCounts() {
    if (!els.industryChipsRoot) return;
    els.industryChipsRoot.querySelectorAll('.event-type-chip[data-category]').forEach(function (chip) {
      var id = chip.getAttribute('data-category') || '';
      var countEl = chip.querySelector('.event-type-chip-count');
      if (!countEl) return;
      var n = id
        ? countMatching(function (item) {
            return item.category === id;
          }, { category: true })
        : countMatching(null, { category: true });
      countEl.textContent = '(' + n + ')';
      var isZero = Boolean(id) && n === 0;
      var keepVisible = chip.classList.contains('is-active');
      chip.classList.toggle('is-zero', isZero);
      chip.hidden = isZero && !keepVisible;
    });
  }

  function updateTypeChipCounts() {
    if (!els.typeChipsRoot) return;
    els.typeChipsRoot.querySelectorAll('.event-type-chip[data-type]').forEach(function (chip) {
      var type = chip.getAttribute('data-type') || 'all';
      var countEl = chip.querySelector('.event-type-chip-count');
      if (!countEl) return;
      var n =
        type === 'all'
          ? visibleListingCountForAllChip()
          : countMatching(function (item) {
              return hasTag(item, type);
            }, { type: true });
      countEl.textContent = '(' + n + ')';
      var isZero = type !== 'all' && n === 0;
      var keepVisible = chip.classList.contains('is-active');
      chip.classList.toggle('is-zero', isZero);
      chip.hidden = isZero && !keepVisible;
    });
    updateIndustryChipCounts();
  }

  function countAdvancedFilters() {
    var n = 0;
    if (activeCategory) n += 1;
    if (activeCommitments.length) n += 1;
    if (minInvest != null || maxInvest != null) n += 1;
    return n;
  }

  function syncMoreFiltersBadge() {
    if (!els.moreBadge) return;
    var n = countAdvancedFilters();
    if (n > 0) {
      els.moreBadge.hidden = false;
      els.moreBadge.setAttribute('aria-hidden', 'false');
      els.moreBadge.textContent = String(n);
    } else {
      els.moreBadge.hidden = true;
      els.moreBadge.setAttribute('aria-hidden', 'true');
      els.moreBadge.textContent = '';
    }
  }

  function openMoreFiltersIfNeeded() {
    if (!els.moreToggle || !els.morePanel) return;
    if (!countAdvancedFilters()) return;
    if (!els.morePanel.hasAttribute('hidden')) return;
    els.morePanel.removeAttribute('hidden');
    els.moreToggle.setAttribute('aria-expanded', 'true');
  }

  function syncCategorySelect() {
    if (els.filterCategory) els.filterCategory.value = activeCategory || '';
    syncIndustryChipUi();
  }

  function renderListings() {
    if (!els.mount) return;

    var totalMatches = sortListings(getFilteredList());
    var filtered = sortListings(getGridListings());
    var listingsBlock = document.getElementById('listings-view');
    if (listingsBlock) listingsBlock.hidden = viewMode === 'map';

    if (viewMode === 'map') {
      updateResultsCount(totalMatches.length);
      if (window.hubRefreshOpportunitiesMap) window.hubRefreshOpportunitiesMap(totalMatches);
      return;
    }

    if (!filtered.length) {
      disconnectLazyObserver();
      els.mount.innerHTML = emptyListingsHtml(totalMatches.length);
      updateResultsCount(totalMatches.length);
      updateTypeChipCounts();
      bindClearFilters();
      bindEmptyStateActions();
      return;
    }

    maybeNudgeSaveSearch();

    var slice = getListingSlice(filtered);
    var lowResultsHtml =
      filtered.length > 0 && filtered.length <= 2 && hasActiveOppMobileFilters()
        ? lowResultsHintHtml(filtered.length)
        : '';

    els.mount.innerHTML =
      listingsRangeHtml(slice.rangeStart, slice.rangeEnd, filtered.length) +
      '<div class="event-grid">' +
      slice.items.map(gridCard).join('') +
      '</div>' +
      (slice.hasMore ? loadMoreHtml(filtered, slice.rangeEnd) : '') +
      paginationHtml(currentPage, slice.totalPages) +
      lowResultsHtml;

    lastRenderedCount = slice.rangeEnd;
    updateResultsCount(totalMatches.length);
    updateTypeChipCounts();
    if (saves) saves.refreshButtons(els.mount);
    if (slice.hasMore) observeLazySentinel();
    else disconnectLazyObserver();
    refreshCompareTray();
    bindEmptyStateActions();
  }

  function emptyListingsHtml(totalMatches) {
    var tips = [];
    if (searchQ) tips.push('check the spelling or try a shorter word');
    if (locationQ || activeLocationTag) tips.push('widen or clear location');
    if (activeInvestTier && activeInvestTier !== 'all') tips.push('try All budgets');
    if (activeTypes.length) tips.push('browse all opportunity types');
    if (activeCategory) tips.push('clear the industry');
    if (!tips.length) tips.push('clear your filters');

    var emptyTitle = searchQ
      ? 'No opportunities found for “' + escapeHtml(searchQ) + '”'
      : 'No opportunities match these filters';
    var emptyCopy = searchQ
      ? 'Check the spelling, try a shorter word, or ' +
        escapeHtml(tips.slice(1, 3).join(', or ') || 'clear your filters') +
        '.'
      : 'Try to ' + escapeHtml(tips.slice(0, 2).join(', or ')) + ' — or check back soon as new listings go live.';

    return (
      '<div class="events-empty opp-empty-state" role="status">' +
      '<p class="opp-empty-title">' +
      emptyTitle +
      '</p>' +
      '<p class="opp-empty-copy">' +
      emptyCopy +
      '</p>' +
      '<div class="opp-empty-actions">' +
      '<button type="button" class="opp-empty-btn" id="opp-clear-filters">Clear filters</button>' +
      (locationQ || activeLocationTag
        ? '<button type="button" class="clear-filters-link" id="opp-clear-location">Clear location only</button>'
        : '') +
      '<button type="button" class="clear-filters-link" id="opp-empty-alert">Alert me for this search</button>' +
      '</div>' +
      emptyProviderCtaHtml() +
      '</div>'
    );
  }

  function emptyProviderCtaHtml() {
    return (
      '<p class="opp-empty-provider">Provider with a franchise or side hustle? ' +
      '<a href="/organiser/opportunity-edit" data-hub-action="add-opportunity">List your opportunity</a></p>'
    );
  }

  function lowResultsHintHtml(count) {
    return (
      '<div class="opp-low-results" role="status">' +
      '<p>Only <strong>' +
      count +
      '</strong> match' +
      (count === 1 ? '' : 'es') +
      '. ' +
      '<button type="button" class="clear-filters-link" id="opp-low-clear-filters">Widen filters</button>' +
      ' or ' +
      '<a href="/organiser/opportunity-edit" data-hub-action="add-opportunity">list an opportunity</a>.</p>' +
      '</div>'
    );
  }

  function bindEmptyStateActions() {
    bindClearFilters();
    var clearLoc = document.getElementById('opp-clear-location');
    if (clearLoc && !clearLoc.dataset.bound) {
      clearLoc.dataset.bound = '1';
      clearLoc.addEventListener('click', function () {
        locationQ = '';
        activeLocationTag = '';
        if (els.postcode) els.postcode.value = '';
        applyFilters();
      });
    }
    var emptyAlert = document.getElementById('opp-empty-alert');
    if (emptyAlert && !emptyAlert.dataset.bound) {
      emptyAlert.dataset.bound = '1';
      emptyAlert.addEventListener('click', function () {
        openAlertDialog();
      });
    }
    var lowClear = document.getElementById('opp-low-clear-filters');
    if (lowClear && !lowClear.dataset.bound) {
      lowClear.dataset.bound = '1';
      lowClear.addEventListener('click', resetFilters);
    }
  }

  function maybeNudgeSaveSearch() {
    if (!els.saveSearchBtn) return;
    try {
      if (window.sessionStorage && sessionStorage.getItem('hubOppSaveNudge') === '1') return;
    } catch (e) {
      /* ignore */
    }
    if (!hasActiveOppMobileFilters()) return;
    if (!getFilteredList().length) return;

    els.saveSearchBtn.classList.add('is-nudge');
    try {
      if (window.sessionStorage) sessionStorage.setItem('hubOppSaveNudge', '1');
    } catch (err) {
      /* ignore */
    }
    window.setTimeout(function () {
      if (els.saveSearchBtn) els.saveSearchBtn.classList.remove('is-nudge');
    }, 4200);
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
    var locationQuery = els.postcode ? String(els.postcode.value || '').trim() : '';
    if (/^remote$/i.test(locationQuery) && activeLocationTag === 'remote') locationQuery = '';
    return {
      type: activeTypes.length === 1 ? activeTypes[0] : activeTypes.length ? activeTypes.join(',') : 'all',
      category: activeCategory || '',
      invest: activeInvestTier === 'all' ? '' : activeInvestTier,
      location: activeLocationTag || '',
      locationQuery: locationQuery,
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
    var typeRaw = String(params.get('type') || '').trim();
    activeTypes = typeRaw
      ? typeRaw
          .split(',')
          .map(function (t) {
            return String(t || '').trim();
          })
          .filter(function (t) {
            return t && t !== 'all' && TAB_TYPES.indexOf(t) !== -1;
          })
      : [];

    // Legacy ?hideNm=0 meant “include network marketing” — map to the type chip once.
    if (!activeTypes.length && params.get('hideNm') === '0') {
      activeTypes = ['network-marketing'];
    }

    activeCategory = params.get('category') || '';
    searchQ = String(params.get('q') || '').trim().toLowerCase();
    sortBy = params.get('sort') || 'recommended';
    activeInvestTier = params.get('invest') || 'all';
    if (
      activeInvestTier !== 'all' &&
      activeInvestTier !== 'low-invest' &&
      activeInvestTier !== 'mid-invest' &&
      activeInvestTier !== 'high-invest' &&
      activeInvestTier !== 'on-request'
    ) {
      activeInvestTier = 'all';
    }
    activeLocationTag = params.get('location') || '';
    var commitment = params.get('commitment') || '';
    activeCommitments = commitment ? commitment.split(',').filter(Boolean) : [];

    if (els.search && searchQ) els.search.value = searchQ;
    if (els.sort) els.sort.value = sortBy;
    if (els.filterCategory && activeCategory) els.filterCategory.value = activeCategory;
    if (params.get('location') === 'remote' && els.postcode && !params.get('loc') && !params.get('q')) {
      els.postcode.value = 'Remote';
    }
    var locQuery = params.get('loc');
    if (locQuery && els.postcode) {
      els.postcode.value = locQuery;
      locationQ = String(locQuery).trim().toLowerCase();
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
    if (c.type && c.type !== 'all') params.set('type', c.type);
    if (c.category) params.set('category', c.category);
    if (c.invest) params.set('invest', c.invest);
    if (c.location) params.set('location', c.location);
    if (c.locationQuery) params.set('loc', c.locationQuery);
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

  function setOppListingsLoading(on) {
    if (!els.mount) return;
    els.mount.classList.toggle('is-updating', !!on);
    els.mount.setAttribute('aria-busy', on ? 'true' : 'false');
    if (els.sort) els.sort.setAttribute('aria-busy', on ? 'true' : 'false');
    document.body.classList.toggle('browse-results-loading', !!on);
    var results = document.getElementById('results');
    if (results) results.classList.toggle('is-updating', !!on);
  }

  function applyFilters() {
    readFiltersFromControls();
    syncCategorySelect();
    syncTypeChipUi();
    syncInvestPills();
    syncCommitmentChecks();
    syncMoreFiltersBadge();
    syncClearFiltersVisibility();
    renderActiveFilters();
    resetListingPagination();
    writeFiltersToUrl();
    setOppListingsLoading(true);
    var token = ++applyFiltersToken;
    var ran = false;
    function runApply() {
      if (ran || token !== applyFiltersToken) return;
      ran = true;
      try {
        renderListings();
        renderSpotlight();
        if (window.hubSyncMobileFilterToggle) window.hubSyncMobileFilterToggle();
        logOpportunityBrowseSearch();
      } finally {
        if (token === applyFiltersToken) setOppListingsLoading(false);
      }
    }
    /* Double rAF so the spinner can paint; setTimeout fallback if rAF is throttled/skipped. */
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(runApply);
      });
    }
    window.setTimeout(runApply, 50);
  }

  function logOpportunityBrowseSearch() {
    if (!window.HubBrowseAnalytics || typeof window.HubBrowseAnalytics.logSearch !== 'function') return;
    if (!hasActiveOppMobileFilters() && !(window.hubOppRegionalLanding && window.hubOppRegionalLanding.slug)) {
      return;
    }
    var regional = window.hubOppRegionalLanding || null;
    var filtered = typeof getGridListings === 'function' ? getGridListings() : [];
    window.HubBrowseAnalytics.logSearch({
      source: 'opportunities_browse',
      q: searchQ || '',
      location: locationQ || activeLocationTag || (regional && (regional.location || regional.name)) || '',
      regionSlug: (regional && regional.slug) || activeLocationTag || '',
      types: activeTypes.join(','),
      category: activeCategory || '',
      invest: activeInvestTier || '',
      commitment: activeCommitments.join(','),
      locationTag: activeLocationTag || '',
      sort: sortBy || '',
      resultCount: filtered.length,
    });
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
    syncMoreFiltersBadge();
    syncClearFiltersVisibility();
    renderActiveFilters();
    writeFiltersToUrl();
    renderListings();
    renderSpotlight();
    if (window.hubSyncMobileFilterToggle) window.hubSyncMobileFilterToggle();
  }

  function setSaveSearchStatus(msg, isError, allowHtml) {
    if (!els.saveSearchStatus) return;
    if (allowHtml) els.saveSearchStatus.innerHTML = msg || '';
    else els.saveSearchStatus.textContent = msg || '';
    els.saveSearchStatus.hidden = !msg;
    els.saveSearchStatus.classList.toggle('is-error', Boolean(isError));
  }

  var alertDraft = null;
  var alertLabelTouched = false;
  var alertDialogLastFocus = null;

  var CATEGORY_LABELS = {
    cleaning: 'Cleaning',
    food: 'Food & Drink',
    tech: 'Tech & Digital',
    health: 'Health & Fitness',
    beauty: 'Beauty & Wellness',
    property: 'Property',
    education: 'Education & Coaching',
    pets: 'Pets & Animals',
    finance: 'Finance & Admin',
    mlm: 'MLM & Network Marketing',
  };

  var INVEST_LABELS = {
    'low-invest': 'Under £2.5k',
    'mid-invest': '£2.5k–£10k',
    'high-invest': '£10k+',
    'on-request': 'On request',
  };

  function criteriaHasAlertableFilter(criteria) {
    if (!criteria) return false;
    return Boolean(
      (criteria.type && criteria.type !== 'all') ||
        criteria.category ||
        criteria.invest ||
        criteria.location ||
        criteria.locationQuery ||
        criteria.commitment ||
        criteria.q ||
        (criteria.minInvest !== '' && criteria.minInvest != null) ||
        (criteria.maxInvest !== '' && criteria.maxInvest != null)
    );
  }

  function defaultAlertLabel(criteria) {
    if (quality && quality.criteriaLabel) return quality.criteriaLabel(criteria);
    return 'Opportunity search alert';
  }

  function typeChipLabel(id) {
    for (var i = 0; i < TYPE_CHIPS.length; i++) {
      if (TYPE_CHIPS[i].id === id) return TYPE_CHIPS[i].label;
    }
    return String(id || '').replace(/-/g, ' ');
  }

  function commitmentChipLabel(id) {
    for (var i = 0; i < COMMITMENTS.length; i++) {
      if (COMMITMENTS[i].id === id) return COMMITMENTS[i].label;
    }
    return String(id || '').replace(/-/g, ' ');
  }

  function alertSummaryChips(criteria) {
    var chips = [];
    if (criteria.type && criteria.type !== 'all') {
      String(criteria.type)
        .split(',')
        .filter(Boolean)
        .forEach(function (id) {
          chips.push({ key: 'type', value: id, label: typeChipLabel(id) });
        });
    }
    if (criteria.category) {
      chips.push({
        key: 'category',
        value: criteria.category,
        label: CATEGORY_LABELS[criteria.category] || criteria.category,
      });
    }
    if (criteria.invest) {
      chips.push({
        key: 'invest',
        value: criteria.invest,
        label: INVEST_LABELS[criteria.invest] || criteria.invest,
      });
    }
    if (criteria.minInvest != null && criteria.minInvest !== '') {
      chips.push({ key: 'minInvest', value: String(criteria.minInvest), label: 'Min £' + criteria.minInvest });
    }
    if (criteria.maxInvest != null && criteria.maxInvest !== '') {
      chips.push({ key: 'maxInvest', value: String(criteria.maxInvest), label: 'Max £' + criteria.maxInvest });
    }
    if (criteria.commitment) {
      String(criteria.commitment)
        .split(',')
        .filter(Boolean)
        .forEach(function (id) {
          chips.push({ key: 'commitment', value: id, label: commitmentChipLabel(id) });
        });
    }
    if (criteria.location) {
      chips.push({
        key: 'location',
        value: criteria.location,
        label: String(criteria.location).replace(/-/g, ' '),
      });
    }
    if (criteria.locationQuery) {
      chips.push({
        key: 'locationQuery',
        value: criteria.locationQuery,
        label: 'Near ' + criteria.locationQuery,
      });
    }
    if (criteria.q) {
      chips.push({ key: 'q', value: criteria.q, label: '“' + criteria.q + '”' });
    }
    return chips;
  }

  function setAlertDialogStatus(msg, isError) {
    var el = document.getElementById('opp-alert-dialog-status');
    if (!el) return;
    el.textContent = msg || '';
    el.hidden = !msg;
    el.classList.toggle('is-error', Boolean(isError));
  }

  function removeAlertDraftChip(key, value) {
    if (!alertDraft) return;
    if (key === 'type') {
      var types = String(alertDraft.type || '')
        .split(',')
        .filter(Boolean)
        .filter(function (t) {
          return t !== value;
        });
      alertDraft.type = types.length ? types.join(',') : 'all';
    } else if (key === 'commitment') {
      var commitments = String(alertDraft.commitment || '')
        .split(',')
        .filter(Boolean)
        .filter(function (c) {
          return c !== value;
        });
      alertDraft.commitment = commitments.join(',');
    } else if (key === 'category' || key === 'invest' || key === 'location' || key === 'locationQuery' || key === 'q') {
      alertDraft[key] = '';
    } else if (key === 'minInvest' || key === 'maxInvest') {
      alertDraft[key] = '';
    }
  }

  function renderAlertDialogChips() {
    var root = document.getElementById('opp-alert-chips');
    if (!root || !alertDraft) return;
    var chips = alertSummaryChips(alertDraft);
    if (!chips.length) {
      root.innerHTML = '<li class="opp-alert-dialog-chip-empty">No filters left — add some on the page, then try again.</li>';
      return;
    }
    root.innerHTML = chips
      .map(function (chip) {
        return (
          '<li><button type="button" class="opp-alert-dialog-chip" data-alert-key="' +
          escapeHtml(chip.key) +
          '" data-alert-value="' +
          escapeHtml(chip.value) +
          '">' +
          '<span>' +
          escapeHtml(chip.label) +
          '</span>' +
          '<span class="opp-alert-dialog-chip-x" aria-hidden="true">×</span>' +
          '<span class="visually-hidden">Remove</span>' +
          '</button></li>'
        );
      })
      .join('');
  }

  function syncAlertDialogLabel() {
    var input = document.getElementById('opp-alert-label');
    if (!input || !alertDraft || alertLabelTouched) return;
    input.value = defaultAlertLabel(alertDraft);
  }

  function closeAlertDialog() {
    var dialog = document.getElementById('opp-alert-dialog');
    if (!dialog) return;
    dialog.hidden = true;
    dialog.setAttribute('aria-hidden', 'true');
    if ('inert' in dialog) dialog.inert = true;
    document.body.classList.remove('opp-alert-dialog-open');
    alertDraft = null;
    alertLabelTouched = false;
    setAlertDialogStatus('');
    if (alertDialogLastFocus && typeof alertDialogLastFocus.focus === 'function') {
      alertDialogLastFocus.focus();
    }
    alertDialogLastFocus = null;
  }

  function openAlertDialog() {
    readFiltersFromControls();
    var criteria = currentFilterCriteria();
    if (!criteriaHasAlertableFilter(criteria)) {
      setSaveSearchStatus('Set at least one filter before saving an alert.', true);
      return;
    }

    setSaveSearchStatus('');
    alertDraft = JSON.parse(JSON.stringify(criteria));
    alertLabelTouched = false;
    alertDialogLastFocus = document.activeElement;

    var dialog = document.getElementById('opp-alert-dialog');
    var labelInput = document.getElementById('opp-alert-label');
    var notifyInput = document.getElementById('opp-alert-notify-email');
    if (!dialog) return;

    if (labelInput) labelInput.value = defaultAlertLabel(alertDraft);
    if (notifyInput) notifyInput.checked = true;
    renderAlertDialogChips();
    setAlertDialogStatus('');

    dialog.hidden = false;
    dialog.setAttribute('aria-hidden', 'false');
    if ('inert' in dialog) dialog.inert = false;
    document.body.classList.add('opp-alert-dialog-open');
    if (labelInput) {
      labelInput.focus();
      labelInput.select();
    }
  }

  function confirmSaveAlert() {
    if (!alertDraft || !criteriaHasAlertableFilter(alertDraft)) {
      setAlertDialogStatus('Keep at least one filter on this alert.', true);
      renderAlertDialogChips();
      return;
    }

    var labelInput = document.getElementById('opp-alert-label');
    var notifyInput = document.getElementById('opp-alert-notify-email');
    var saveBtn = document.getElementById('opp-alert-dialog-save');
    var label = labelInput ? String(labelInput.value || '').trim() : '';
    if (!label) label = defaultAlertLabel(alertDraft);

    if (saveBtn) saveBtn.disabled = true;
    if (els.saveSearchBtn) els.saveSearchBtn.disabled = true;
    setAlertDialogStatus('Saving alert…');

    fetch('/api/auth/opportunity-saved-searches', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        criteria: alertDraft,
        label: label,
        notifyEmail: !notifyInput || notifyInput.checked,
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
        closeAlertDialog();
        setSaveSearchStatus(
          'Alert saved — we will email you when new listings match. ' +
            '<a href="/account/#search-alerts">Manage alerts in My account</a>.',
          false,
          true
        );
      })
      .catch(function (e) {
        setAlertDialogStatus(e.message || 'Could not save alert. Try again.', true);
      })
      .finally(function () {
        if (saveBtn) saveBtn.disabled = false;
        if (els.saveSearchBtn) els.saveSearchBtn.disabled = false;
      });
  }

  function initAlertDialog() {
    var dialog = document.getElementById('opp-alert-dialog');
    if (!dialog || dialog.dataset.bound) return;
    dialog.dataset.bound = '1';

    var labelInput = document.getElementById('opp-alert-label');
    var chips = document.getElementById('opp-alert-chips');
    var closeBtn = document.getElementById('opp-alert-dialog-close');
    var cancelBtn = document.getElementById('opp-alert-dialog-cancel');
    var saveBtn = document.getElementById('opp-alert-dialog-save');
    var backdrop = document.getElementById('opp-alert-dialog-backdrop');

    if (labelInput) {
      labelInput.addEventListener('input', function () {
        alertLabelTouched = true;
      });
    }

    if (chips) {
      chips.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-alert-key]');
        if (!btn) return;
        removeAlertDraftChip(btn.getAttribute('data-alert-key'), btn.getAttribute('data-alert-value'));
        renderAlertDialogChips();
        syncAlertDialogLabel();
        if (!criteriaHasAlertableFilter(alertDraft)) {
          setAlertDialogStatus('Keep at least one filter on this alert.', true);
        } else {
          setAlertDialogStatus('');
        }
      });
    }

    function onClose() {
      closeAlertDialog();
    }

    if (closeBtn) closeBtn.addEventListener('click', onClose);
    if (cancelBtn) cancelBtn.addEventListener('click', onClose);
    if (backdrop) backdrop.addEventListener('click', onClose);
    if (saveBtn) saveBtn.addEventListener('click', confirmSaveAlert);

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!dialog || dialog.hidden) return;
      e.preventDefault();
      closeAlertDialog();
    });
  }

  function saveSearchAlert() {
    openAlertDialog();
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
    var mapListBtn = document.getElementById('opp-map-mobile-list-btn');
    if (mapListBtn) {
      mapListBtn.addEventListener('click', function () {
        setView('grid');
      });
    }
    syncViewToggleUI();
  }

  function initFilterBar() {
    rememberFilterOptionLabels();
    buildTypeChips();
    buildIndustryChips();

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

    if (window.HUB_initMobileFilterSheet) {
      var sheetCtrl = window.HUB_initMobileFilterSheet({
        getTitle: function () {
          return 'Filter opportunities';
        },
        hasActiveFilters: hasActiveOppMobileFilters,
        getApplyLabel: function () {
          var n =
            window.hubOppBrowseTotal != null
              ? window.hubOppBrowseTotal
              : typeof filtered !== 'undefined'
                ? filtered.length
                : null;
          if (n == null && els.resultsCount) {
            n = parseInt(String(els.resultsCount.textContent || ''), 10);
          }
          n = Number(n);
          if (!isFinite(n) || n < 0) return 'Show results';
          return 'Show ' + n.toLocaleString('en-GB') + ' result' + (n === 1 ? '' : 's');
        },
        onApply: applyFilters,
        onClear: resetFilters,
      });
      if (sheetCtrl) window.hubSyncMobileFilterToggle = sheetCtrl.sync;
    }
  }

  function hasActiveOppMobileFilters() {
    readFiltersFromControls();
    if (searchQ) return true;
    if (locationQ) return true;
    if (activeCategory) return true;
    if (activeTypes.length) return true;
    if (activeInvestTier && activeInvestTier !== 'all') return true;
    if (activeCommitments.length) return true;
    if (minInvest != null || maxInvest != null) return true;
    if (activeLocationTag) return true;
    return false;
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
      var filtered = getGridListings();
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
    bindActiveFilters();
    syncMoreFiltersBadge();
    openMoreFiltersIfNeeded();
    syncClearFiltersVisibility();
    renderActiveFilters();
    initSearch();
    initSort();
    initViewToggle();
    initPagination();
    initFavClicks();
    bindCompareControls();
    initCopyLink();
    initSaveSearch();
    initAlertDialog();
    syncTypeChipUi();
    syncInvestPills();
    syncCommitmentChecks();
    syncCategorySelect();
    // Drop legacy ?hideNm= from the address bar (opt-in is now ?type=network-marketing).
    writeFiltersToUrl();
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
