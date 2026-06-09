(function () {
  var searchInput = document.getElementById('search');
  var postcodeInput = document.getElementById('postcode');
  var sortSelect = document.getElementById('sort');
  var dateRangeInput = document.getElementById('date-range');
  var checkInPerson = document.getElementById('check-inperson');
  var checkOnline = document.getElementById('check-online');
  var checkFreeOnly = document.getElementById('filter-free-only');
  var priceMax = document.getElementById('price-max');
  var priceMaxOut = document.getElementById('price-max-out');
  var PRICE_SLIDER_FALLBACK = 100;
  var priceSliderCap = PRICE_SLIDER_FALLBACK;
  var toggleNearMe = document.getElementById('toggle-nearme');
  var locationRadius = document.getElementById('location-radius');
  var locationRadiusWrap = document.getElementById('location-radius-wrap');
  var nearRadius = document.getElementById('near-radius');
  var nearRadiusWrap = document.getElementById('near-radius-wrap');
  var toggleNearMeMobile = document.getElementById('toggle-nearme-mobile');
  var nearRadiusMobile = document.getElementById('near-radius-mobile');
  var nearRadiusWrapMobile = document.getElementById('near-radius-wrap-mobile');
  var resultsCount = document.getElementById('results-count');
  var typeTabs = document.querySelectorAll('.event-type-chip[data-type]');
  var typeChipsRoot = document.getElementById('event-type-chips');

  var activeTypeTabs = [];
  var dateFromTs = null;
  var dateToTs = null;
  var flatpickrInstance = null;
  var locationResolveTimer = null;
  var FILTER_STORAGE_KEY = 'hubEventBrowseFilters';

  function slugForEventType(type) {
    if (window.hubSlugForEventType) return window.hubSlugForEventType(type);
    return String(type || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function eventTypeSlug(ev) {
    if (ev.typeSlug) return ev.typeSlug;
    var raw = ev.eventType || ev.typeRaw || '';
    if (window.hubNormalizeEventType) raw = window.hubNormalizeEventType(raw);
    return slugForEventType(raw);
  }

  function buildTypeChips() {
    if (!typeChipsRoot) return;
    var types = window.HUB_MEETING_TYPES || [];
    var html =
      '<button type="button" class="event-type-chip is-active" data-type="all" aria-pressed="true">' +
      'All <span class="event-type-chip-count">(0)</span></button>';
    types.forEach(function (item) {
      var slug = slugForEventType(item.value);
      html +=
        '<button type="button" class="event-type-chip" data-type="' +
        slug +
        '" aria-pressed="false">' +
        item.label +
        ' <span class="event-type-chip-count">(0)</span></button>';
    });
    typeChipsRoot.innerHTML = html;
    typeChipsRoot.setAttribute('aria-label', 'Event type — select one or more');
    typeTabs = document.querySelectorAll('.event-type-chip[data-type]');
    syncTypeChipUi();
    typeTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        if (document.body.classList.contains('browse-mode-organisers')) return;
        toggleTypeTab(tab.getAttribute('data-type') || 'all');
        applyFilters();
      });
    });
  }

  buildTypeChips();
  window.hubBuildEventTypeChips = buildTypeChips;
  window.hubEventTypeSlug = eventTypeSlug;

  function getActiveTypeTab() {
    return activeTypeTabs.length === 0 ? 'all' : activeTypeTabs[0];
  }

  function syncTypeChipUi() {
    typeTabs = document.querySelectorAll('.event-type-chip[data-type]');
    var hasSelection = activeTypeTabs.length > 0;
    typeTabs.forEach(function (tab) {
      var type = tab.getAttribute('data-type') || 'all';
      var active = type === 'all' ? !hasSelection : activeTypeTabs.indexOf(type) !== -1;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function toggleTypeTab(type) {
    type = type || 'all';
    if (type === 'all') {
      activeTypeTabs = [];
    } else {
      var idx = activeTypeTabs.indexOf(type);
      if (idx >= 0) activeTypeTabs.splice(idx, 1);
      else activeTypeTabs.push(type);
    }
    syncTypeChipUi();
  }

  function meetingTypeSlug(ev) {
    var raw = String(ev.format || ev.meetingType || '').trim().toLowerCase();
    if (!raw) return '';
    if (raw.indexOf('hybrid') !== -1) return 'hybrid';
    if (raw.indexOf('online') !== -1 && raw.indexOf('person') === -1) return 'online';
    if (raw.indexOf('person') !== -1 || raw.indexOf('in person') !== -1) return 'in-person';
    return ev.formatSlug || '';
  }

  function eventDateTs(ev) {
    if (ev.nextDateTs != null && !Number.isNaN(ev.nextDateTs)) return ev.nextDateTs;
    if (ev.dateTs != null && !Number.isNaN(ev.dateTs)) return ev.dateTs;
    if (ev.nextDate) {
      var t = new Date(ev.nextDate).getTime();
      return Number.isNaN(t) ? null : t;
    }
    if (ev.dateRaw) {
      var d = new Date(ev.dateRaw).getTime();
      return Number.isNaN(d) ? null : d;
    }
    return null;
  }

  function eventTicketPrice(ev) {
    var n = Number(ev.priceNum);
    if (!Number.isNaN(n) && n >= 0) return n;
    if (ev.priceKey === 'free') return 0;
    return 0;
  }

  function formatPriceLabel(value, isMax) {
    var n = Number(value) || 0;
    var cap = priceSliderCap;
    if (isMax && n >= cap) return 'Any';
    return '£' + n + ' max';
  }

  function syncPriceOutputs() {
    if (priceMaxOut && priceMax) priceMaxOut.textContent = formatPriceLabel(priceMax.value, true);
  }

  function getPriceBounds() {
    var minVal = 0;
    var maxVal = priceMax ? Number(priceMax.value) : priceSliderCap;
    return { minVal: minVal, maxVal: maxVal };
  }

  function onPriceSliderInput() {
    syncPriceOutputs();
    applyFilters();
  }

  function initPriceSliderMax() {
    var all = window.hubAllEvents || [];
    if (!all.length || !priceMax) return;
    var peak = 0;
    all.forEach(function (ev) {
      var n = eventMaxTicketPrice(ev);
      if (n > peak) peak = n;
    });
    var prevCap = priceSliderCap;
    var cap = peak > 0 ? Math.ceil(peak / 5) * 5 : PRICE_SLIDER_FALLBACK;
    priceSliderCap = cap;
    priceMax.max = String(cap);
    var currentVal = Number(priceMax.value);
    if (currentVal > cap || currentVal >= prevCap) {
      priceMax.value = String(cap);
    }
    syncPriceOutputs();
  }

  window.hubInitPriceFilter = initPriceSliderMax;

  function getLocationRadiusMiles() {
    var el = locationRadius;
    var n = el ? Number(el.value) : 25;
    return n === 5 || n === 50 ? n : 25;
  }

  function getNearRadiusMiles() {
    return getLocationRadiusMiles();
  }

  function syncLocationRadiusControls() {
    var value = String(getLocationRadiusMiles());
    if (locationRadius && locationRadius.value !== value) locationRadius.value = value;
    if (nearRadius && nearRadius.value !== value) nearRadius.value = value;
    if (nearRadiusMobile && nearRadiusMobile.value !== value) nearRadiusMobile.value = value;
  }

  function isMobileFilterLayout() {
    return window.matchMedia('(max-width: 900px)').matches;
  }

  function syncNearControls(source) {
    if (source !== 'mobile') {
      if (toggleNearMeMobile && toggleNearMe) {
        toggleNearMeMobile.checked = toggleNearMe.checked;
      }
    }
    if (source !== 'desktop') {
      if (toggleNearMe && toggleNearMeMobile) {
        toggleNearMe.checked = toggleNearMeMobile.checked;
      }
    }
    syncLocationRadiusControls();
  }

  function isNearMeActive() {
    if (isMobileFilterLayout() && toggleNearMeMobile) {
      return toggleNearMeMobile.checked;
    }
    return !!(toggleNearMe && toggleNearMe.checked);
  }

  function activeNearToggle() {
    return isMobileFilterLayout() && toggleNearMeMobile
      ? toggleNearMeMobile
      : toggleNearMe;
  }

  function syncNearRadiusUi() {
    syncNearControls(isMobileFilterLayout() ? 'mobile' : 'desktop');
    var pc = (postcodeInput && postcodeInput.value) || '';
    pc = pc.trim();
    var enabled = pc.length > 0 || isNearMeActive();
    if (locationRadius) locationRadius.disabled = !enabled;
    if (locationRadiusWrap) locationRadiusWrap.hidden = false;
  }

  function locationFilterCenter() {
    if (isNearMeActive() && window.hubUserCoords) return window.hubUserCoords;
    if (window.hubLocationFilterCoords) return window.hubLocationFilterCoords;
    return null;
  }

  function eventSearchHaystack(ev) {
    var typeLabel = ev.eventType || ev.typeRaw || '';
    if (window.hubNormalizeEventType) typeLabel = window.hubNormalizeEventType(typeLabel);
    return [
      ev.search,
      ev.title,
      typeLabel,
      ev.organiser,
      ev.location,
      ev.city,
      ev.venue,
      ev.postcode,
      ev.format,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  function isLocationFilterActive() {
    var pc = (postcodeInput && postcodeInput.value) || '';
    return pc.trim().length > 0 || isNearMeActive();
  }

  function eventMatchesPostcodeArea(pc, ev, center) {
    if (!isLocationFilterActive()) return true;

    var deliveryFmt = meetingTypeSlug(ev);
    if (deliveryFmt === 'online') return true;

    if (isNearMeActive()) {
      if (!window.hubUserCoords) return false;
      center = window.hubUserCoords;
    }

    var evCoords = eventCoords(ev);
    if (center && evCoords && window.hubDistanceMiles) {
      return (
        window.hubDistanceMiles(center[0], center[1], evCoords[0], evCoords[1]) <=
        getLocationRadiusMiles()
      );
    }

    if (center) return false;

    if (pc && window.hubMatchOutcode) return window.hubMatchOutcode(pc, ev);
    if (pc && window.hubParseOutcode) {
      var userOc = window.hubParseOutcode(pc);
      var eventOc = window.hubEventOutcode ? window.hubEventOutcode(ev) : '';
      return !(userOc && eventOc && userOc !== eventOc);
    }

    return !isNearMeActive();
  }

  function resolveLocationFilterCoords(value) {
    if (!value) {
      window.hubLocationFilterCoords = null;
      return Promise.resolve(null);
    }
    if (window.hubGeocodeLocationQuery) {
      return window.hubGeocodeLocationQuery(value).then(function (coords) {
        window.hubLocationFilterCoords = coords;
        return coords;
      });
    }
    window.hubLocationFilterCoords = null;
    return Promise.resolve(null);
  }

  function resolveNearMeCoords() {
    if (!isNearMeActive()) {
      window.hubUserCoords = null;
      syncNearRadiusUi();
      return Promise.resolve(null);
    }
    syncNearRadiusUi();
    var pc = (postcodeInput && postcodeInput.value) || '';
    pc = pc.trim();
    if (pc && window.hubGeocodeUserPostcode) {
      return window.hubGeocodeUserPostcode(pc);
    }
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      return new Promise(function (resolve) {
        navigator.geolocation.getCurrentPosition(
          function (pos) {
            window.hubUserCoords = [pos.coords.latitude, pos.coords.longitude];
            resolve(window.hubUserCoords);
          },
          function () {
            window.hubUserCoords = null;
            resolve(null);
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
        );
      });
    }
    window.hubUserCoords = null;
    return Promise.resolve(null);
  }

  function applyNearMeFilters() {
    if (document.body.classList.contains('browse-mode-organisers')) return;
    if (!isNearMeActive()) {
      window.hubUserCoords = null;
      syncNearRadiusUi();
      applyLocationFilters();
      return;
    }
    var all = window.hubAllEvents || [];
    var enrich = window.hubEnrichEventCoords ? window.hubEnrichEventCoords(all) : Promise.resolve();
    enrich
      .then(function () {
        return resolveNearMeCoords();
      })
      .then(function () {
        applyFilters();
      });
  }

  function applyLocationFilters() {
    if (document.body.classList.contains('browse-mode-organisers')) return;
    if (isNearMeActive()) {
      applyNearMeFilters();
      return;
    }

    var pc = (postcodeInput && postcodeInput.value) || '';
    pc = pc.trim();
    if (!pc) {
      window.hubLocationFilterCoords = null;
      syncNearRadiusUi();
      applyFilters();
      return;
    }

    syncNearRadiusUi();
    var all = window.hubAllEvents || [];
    var enrich = window.hubEnrichEventCoords ? window.hubEnrichEventCoords(all) : Promise.resolve();
    enrich.then(function () {
      applyFilters();
    });
  }

  function eventCoords(ev) {
    if (ev.mapLat != null && ev.mapLng != null) return [ev.mapLat, ev.mapLng];
    if (Number.isFinite(ev.lat) && Number.isFinite(ev.lng)) return [ev.lat, ev.lng];
    return null;
  }

  function eventMatchesFilters(ev) {
    if (activeTypeTabs.length > 0) {
      if (activeTypeTabs.indexOf(eventTypeSlug(ev)) === -1) return false;
    }

    var q = (searchInput && searchInput.value) || '';
    q = q.trim().toLowerCase();
    if (q) {
      var hay = eventSearchHaystack(ev);
      var terms = q.split(/\s+/).filter(Boolean);
      for (var i = 0; i < terms.length; i++) {
        if (hay.indexOf(terms[i]) === -1) return false;
      }
    }

    var pc = (postcodeInput && postcodeInput.value) || '';
    pc = pc.trim();
    if (!eventMatchesPostcodeArea(pc, ev, locationFilterCenter())) return false;

    var wantInPerson = checkInPerson && checkInPerson.checked;
    var wantOnline = checkOnline && checkOnline.checked;
    var fmt = meetingTypeSlug(ev);
    if (checkInPerson || checkOnline) {
      if (!wantInPerson && !wantOnline) return false;
      if (!fmt) {
        if (!wantInPerson) return false;
      } else if (fmt === 'in-person' && !wantInPerson) return false;
      else if (fmt === 'online' && !wantOnline) return false;
      else if (fmt === 'hybrid' && !wantInPerson && !wantOnline) return false;
    }

    if (dateFromTs || dateToTs) {
      var evTs = eventDateTs(ev);
      if (evTs == null || Number.isNaN(evTs)) return false;
      if (dateFromTs && evTs < dateFromTs) return false;
      if (dateToTs && evTs > dateToTs) return false;
    }

    if (checkFreeOnly && checkFreeOnly.checked && eventTicketPrice(ev) > 0) {
      return false;
    }

    var bounds = getPriceBounds();
    var ticketPrice = eventTicketPrice(ev);
    if (bounds.maxVal < priceSliderCap && ticketPrice > bounds.maxVal) return false;

    return true;
  }

  function sortEvents(list) {
    var sort = (sortSelect && sortSelect.value) || 'recommended';
    var copy = list.slice();
    copy.sort(function (a, b) {
      if (sort === 'rating') {
        return (Number(b.rating) || 0) - (Number(a.rating) || 0);
      }
      if (sort === 'price') {
        return (Number(a.priceNum) || 0) - (Number(b.priceNum) || 0);
      }
      if (sort === 'date') {
        var da = eventDateTs(a);
        var db = eventDateTs(b);
        if (da == null && db == null) return 0;
        if (da == null) return 1;
        if (db == null) return -1;
        return da - db;
      }
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      var ra = Number(a.rating) || 0;
      var rb = Number(b.rating) || 0;
      if (rb !== ra) return rb - ra;
      var d1 = eventDateTs(a);
      var d2 = eventDateTs(b);
      if (d1 == null) d1 = Infinity;
      if (d2 == null) d2 = Infinity;
      return d1 - d2;
    });
    return copy;
  }

  window.hubGetFilteredEvents = function (all, options) {
    options = options || {};
    var savedTabs = activeTypeTabs.slice();
    if (options.typeTabs != null) {
      activeTypeTabs = options.typeTabs.slice();
    } else if (options.typeTab != null) {
      activeTypeTabs = options.typeTab === 'all' ? [] : [options.typeTab];
    }
    var list = (all || window.hubAllEvents || []).filter(eventMatchesFilters);
    activeTypeTabs = savedTabs;
    return sortEvents(list);
  };

  function applyFilters() {
    if (document.body.classList.contains('browse-mode-organisers')) {
      if (window.hubApplyOrganiserFilters) window.hubApplyOrganiserFilters();
      return;
    }
    var all = window.hubAllEvents || [];
    var filtered = window.hubGetFilteredEvents(all);

    if (resultsCount) resultsCount.textContent = String(filtered.length);

    if (window.hubRefreshListings) window.hubRefreshListings();
    if (window.hubRefreshMap) window.hubRefreshMap(filtered);
    if (window.hubUpdateEventTypeChipCounts) window.hubUpdateEventTypeChipCounts();
    saveFilterPrefs();
  }

  function saveFilterPrefs() {
    if (document.body.classList.contains('browse-mode-organisers')) return;
    try {
      sessionStorage.setItem(
        FILTER_STORAGE_KEY,
        JSON.stringify({
          search: searchInput ? searchInput.value : '',
          postcode: postcodeInput ? postcodeInput.value : '',
          nearMe: isNearMeActive(),
          locationRadius: String(getLocationRadiusMiles()),
          nearRadius: String(getLocationRadiusMiles()),
          freeOnly: !!(checkFreeOnly && checkFreeOnly.checked),
          inPerson: !!(checkInPerson && checkInPerson.checked),
          online: !!(checkOnline && checkOnline.checked),
          priceMax: priceMax ? priceMax.value : '',
          sort: sortSelect ? sortSelect.value : 'recommended',
          typeTabs: activeTypeTabs.slice(),
        })
      );
    } catch (e) {
      /* ignore */
    }
  }

  function restoreFilterPrefs() {
    try {
      var raw = sessionStorage.getItem(FILTER_STORAGE_KEY);
      if (!raw) return Promise.resolve();
      var prefs = JSON.parse(raw);
      if (searchInput && prefs.search) searchInput.value = prefs.search;
      if (postcodeInput && prefs.postcode) postcodeInput.value = prefs.postcode;
      if (checkFreeOnly) checkFreeOnly.checked = !!prefs.freeOnly;
      if (checkInPerson && prefs.inPerson === false) checkInPerson.checked = false;
      if (checkOnline && prefs.online === false) checkOnline.checked = false;
      if (priceMax && prefs.priceMax) {
        var restored = Number(prefs.priceMax);
        var cap = Number(priceMax.max) || priceSliderCap;
        priceMax.value = String(!Number.isNaN(restored) && restored <= cap ? restored : cap);
      }
      if (sortSelect && prefs.sort) sortSelect.value = prefs.sort;
      if (toggleNearMe) toggleNearMe.checked = !!prefs.nearMe;
      if (toggleNearMeMobile) toggleNearMeMobile.checked = !!prefs.nearMe;
      var restoredRadius = prefs.locationRadius || prefs.nearRadius;
      if (locationRadius && restoredRadius) locationRadius.value = restoredRadius;
      if (nearRadius && restoredRadius) nearRadius.value = restoredRadius;
      if (nearRadiusMobile && restoredRadius) nearRadiusMobile.value = restoredRadius;
      if (Array.isArray(prefs.typeTabs)) {
        activeTypeTabs = prefs.typeTabs.slice();
        syncTypeChipUi();
      } else if (prefs.typeTab) {
        var restoredType = prefs.typeTab;
        if (restoredType === 'meeting') restoredType = 'networking-meeting';
        setActiveTypeTab(restoredType);
      }
      syncPriceOutputs();
      syncNearRadiusUi();
      if (postcodeInput && prefs.postcode) {
        var restorePc = prefs.postcode;
        var resolveFilter = window.hubResolveLocationFilter
          ? window.hubResolveLocationFilter(restorePc)
          : Promise.resolve();
        return Promise.all([resolveFilter, resolveLocationFilterCoords(restorePc)]).then(function () {
          syncNearRadiusUi();
        });
      }
    } catch (e) {
      /* ignore */
    }
    return Promise.resolve();
  }

  window.hubRestoreEventFilterPrefs = function () {
    return restoreFilterPrefs().then(function () {
      if (isNearMeActive()) {
        applyNearMeFilters();
        return;
      }
      applyFilters();
    });
  };

  function runLocationFilterRefresh() {
    if (isNearMeActive()) applyNearMeFilters();
    else applyFilters();
  }

  function onPostcodeInput() {
    if (document.body.classList.contains('browse-mode-organisers')) return;
    clearTimeout(locationResolveTimer);
    var value = (postcodeInput && postcodeInput.value) || '';
    value = value.trim();
    if (!value) {
      window.hubLocationFilterState = null;
      window.hubLocationFilterCoords = null;
      syncNearRadiusUi();
      runLocationFilterRefresh();
      return;
    }
    locationResolveTimer = setTimeout(function () {
      var resolveFilter = window.hubResolveLocationFilter
        ? window.hubResolveLocationFilter(value)
        : Promise.resolve();
      var resolveCoords = resolveLocationFilterCoords(value);
      Promise.all([resolveFilter, resolveCoords])
        .then(function () {
          syncNearRadiusUi();
          var all = window.hubAllEvents || [];
          var enrich = window.hubEnrichEventCoords
            ? window.hubEnrichEventCoords(all)
            : Promise.resolve();
          return enrich.then(runLocationFilterRefresh);
        });
    }, 280);
  }

  function resetFilters() {
    if (searchInput) searchInput.value = '';
    if (postcodeInput) postcodeInput.value = '';
    if (sortSelect) sortSelect.value = 'recommended';
    if (flatpickrInstance) flatpickrInstance.clear();
    syncDateWrapState([]);
    dateFromTs = null;
    dateToTs = null;
    if (checkInPerson) checkInPerson.checked = true;
    if (checkOnline) checkOnline.checked = true;
    if (checkFreeOnly) checkFreeOnly.checked = false;
    if (priceMax) {
      priceMax.value = priceMax.max || String(priceSliderCap);
    }
    syncPriceOutputs();
    if (toggleNearMe) toggleNearMe.checked = false;
    if (toggleNearMeMobile) toggleNearMeMobile.checked = false;
    if (locationRadius) locationRadius.value = '25';
    if (nearRadius) nearRadius.value = '25';
    if (nearRadiusMobile) nearRadiusMobile.value = '25';
    window.hubUserCoords = null;
    window.hubLocationFilterState = null;
    window.hubLocationFilterCoords = null;
    syncNearRadiusUi();
    setActiveTypeTab('all');
    try {
      sessionStorage.removeItem(FILTER_STORAGE_KEY);
    } catch (e) {
      /* ignore */
    }
    applyFilters();
  }

  function setActiveTypeTab(type) {
    activeTypeTabs = [];
    if (type && type !== 'all') activeTypeTabs = [type];
    syncTypeChipUi();
  }

  window.hubUpdateEventTypeChipCounts = function () {
    var all = window.hubAllEvents || [];
    typeTabs = document.querySelectorAll('.event-type-chip[data-type]');
    typeTabs.forEach(function (chip) {
      var type = chip.getAttribute('data-type') || 'all';
      var countEl = chip.querySelector('.event-type-chip-count');
      if (!countEl) return;
      var list =
        type === 'all'
          ? window.hubGetFilteredEvents(all, { typeTab: 'all' })
          : window.hubGetFilteredEvents(all, { typeTabs: [type] });
      var count = list.length;
      countEl.textContent = '(' + count + ')';
      chip.classList.toggle('is-zero', count === 0);
    });
  };

  window.hubApplyFilters = applyFilters;
  window.hubResetFilters = resetFilters;
  window.hubSetTypeTab = setActiveTypeTab;
  window.hubIsNearMeActive = isNearMeActive;
  window.hubNearRadiusMiles = getNearRadiusMiles;
  window.hubLocationRadiusMiles = getLocationRadiusMiles;

  function bindFilter(el) {
    if (!el) return;
    el.addEventListener('input', applyFilters);
    el.addEventListener('change', applyFilters);
  }

  [searchInput, sortSelect, checkInPerson, checkOnline, checkFreeOnly].forEach(bindFilter);

  if (priceMax) {
    priceMax.addEventListener('input', onPriceSliderInput);
  }
  syncPriceOutputs();

  if (postcodeInput) {
    postcodeInput.addEventListener('input', onPostcodeInput);
    postcodeInput.addEventListener('change', onPostcodeInput);
  }
  if (toggleNearMe) {
    toggleNearMe.addEventListener('change', function () {
      syncNearControls('desktop');
      applyNearMeFilters();
    });
  }
  if (toggleNearMeMobile) {
    toggleNearMeMobile.addEventListener('change', function () {
      syncNearControls('mobile');
      applyNearMeFilters();
    });
  }
  function onLocationRadiusChange() {
    syncLocationRadiusControls();
    applyLocationFilters();
  }

  if (locationRadius) {
    locationRadius.addEventListener('change', onLocationRadiusChange);
  }
  syncNearRadiusUi();

  window.addEventListener('resize', function () {
    syncNearRadiusUi();
  });

  var moreToggle = document.getElementById('filter-more-toggle');
  var morePanel = document.getElementById('filter-more-panel');
  if (moreToggle && morePanel) {
    moreToggle.addEventListener('click', function () {
      var open = moreToggle.getAttribute('aria-expanded') === 'true';
      moreToggle.setAttribute('aria-expanded', open ? 'false' : 'true');
      morePanel.hidden = open;
    });
  }

  var clearBtn = document.getElementById('clear-filters');
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      if (document.body.classList.contains('browse-mode-organisers')) {
        if (window.hubResetOrganiserFilters) window.hubResetOrganiserFilters();
        return;
      }
      resetFilters();
    });
  }

  document.addEventListener('click', function (e) {
    if (e.target.id === 'empty-reset') {
      if (document.body.classList.contains('browse-mode-organisers')) {
        if (window.hubResetOrganiserFilters) window.hubResetOrganiserFilters();
      } else {
        resetFilters();
      }
    }
    var fav = e.target.closest('.fav-btn[data-event-id]');
    if (fav) {
      e.preventDefault();
      e.stopPropagation();
      var eventId = fav.getAttribute('data-event-id');
      if (window.HubFavourites && eventId) {
        window.HubFavourites.toggle(eventId).then(function () {
          window.HubFavourites.refreshButtons();
        });
      } else {
        fav.classList.toggle('is-active');
      }
    }
  });

  var dateWrap = dateRangeInput && dateRangeInput.closest('.filter-date-wrap');

  function syncDateWrapState(selectedDates) {
    if (!dateWrap) return;
    dateWrap.classList.toggle('is-active', Boolean(selectedDates && selectedDates.length));
  }

  if (dateWrap) {
    dateWrap.addEventListener('click', function (e) {
      if (e.target === dateRangeInput) return;
      if (flatpickrInstance) flatpickrInstance.open();
    });
  }

  if (dateRangeInput && typeof flatpickr !== 'undefined') {
    flatpickrInstance = flatpickr(dateRangeInput, {
      mode: 'range',
      dateFormat: 'd M Y',
      altInput: true,
      altFormat: 'j M Y',
      allowInput: false,
      clickOpens: true,
      wrap: false,
      static: false,
      locale: { rangeSeparator: ' – ' },
      onChange: function (selectedDates) {
        syncDateWrapState(selectedDates);
        if (!selectedDates.length) {
          dateFromTs = null;
          dateToTs = null;
          applyFilters();
          return;
        }
        dateFromTs = selectedDates[0].getTime();
        if (selectedDates.length > 1) {
          var end = new Date(selectedDates[1]);
          end.setHours(23, 59, 59, 999);
          dateToTs = end.getTime();
        } else {
          var endOne = new Date(selectedDates[0]);
          endOne.setHours(23, 59, 59, 999);
          dateToTs = endOne.getTime();
        }
        applyFilters();
      },
      onClose: function (selectedDates) {
        if (selectedDates.length === 1) {
          var end = new Date(selectedDates[0]);
          end.setHours(23, 59, 59, 999);
          dateToTs = end.getTime();
          applyFilters();
        }
      },
    });
  }

  if (location.hash === '#exhibitions' || location.search.indexOf('type=exhibition') !== -1) {
    setActiveTypeTab('exhibition');
  } else if (location.hash === '#netwalking' || location.search.indexOf('type=netwalking') !== -1) {
    setActiveTypeTab('netwalking');
  } else if (location.hash === '#meetings' || location.search.indexOf('type=meeting') !== -1) {
    setActiveTypeTab('networking-meeting');
  }
})();
