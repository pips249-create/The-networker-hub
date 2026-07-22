(function () {
  var searchInput = document.getElementById('search');
  var postcodeInput = document.getElementById('postcode');
  var sortSelect = document.getElementById('sort');
  var dateRangeInput = document.getElementById('date-range');
  var checkInPerson = document.getElementById('check-inperson');
  var checkOnline = document.getElementById('check-online');
  var checkFreeOnly = document.getElementById('filter-free-only');
  var checkFiveStarsOnly = document.getElementById('filter-five-stars-only');
  var priceMinInput = document.getElementById('price-min-input');
  var priceMaxInput = document.getElementById('price-max-input');
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
  var locationRadiusTimer = null;
  var FILTER_STORAGE_KEY = 'hubEventBrowseFilters';

  function slugForEventType(type) {
    if (window.hubSlugForEventType) return window.hubSlugForEventType(type);
    return String(type || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function normalizeTypeTabSlug(slug) {
    var key = String(slug || '').trim();
    if (!key || key === 'all') return key;
    var legacy = {
      'networking-meeting': 'meeting',
      netwalking: 'meeting',
      'sport-social': 'meeting',
      'womens-networking': 'meeting',
      'awards-ceremony': 'meeting',
      session: 'masterclass',
    };
    return legacy[key] || key;
  }

  function eventTypeSlug(ev) {
    if (ev.typeSlug) return normalizeTypeTabSlug(ev.typeSlug);
    var raw = ev.eventType || ev.typeRaw || ev.type || '';
    if (window.hubNormalizeEventType) raw = window.hubNormalizeEventType(raw);
    return normalizeTypeTabSlug(slugForEventType(raw));
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
        applyFilters({ immediate: true });
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
    window.hubBrowseActiveTypeTabs = activeTypeTabs.slice();
    syncTypeChipUi();
  }

  function meetingTypeSlug(ev) {
    var raw = String(ev.format || ev.meetingType || '').trim().toLowerCase();
    if (!raw) return '';
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

  function isUpcomingBrowseEvent(ev) {
    if (window.HubEventTimezone && typeof window.HubEventTimezone.isEventStarted === 'function') {
      return !window.HubEventTimezone.isEventStarted(ev);
    }
    var startRaw = ev.dateRaw || ev.nextDate || ev.dateFieldRaw || null;
    if (!startRaw) return false;
    var startTs = new Date(startRaw).getTime();
    if (Number.isNaN(startTs)) return false;
    return startTs > Date.now();
  }

  function eventTicketPrice(ev) {
    var n = Number(ev.priceNum);
    if (!Number.isNaN(n) && n >= 0) return n;
    if (ev.priceKey === 'free') return 0;
    return 0;
  }

  function eventListingPrice(ev) {
    if (window.HubBookingFees) return window.HubBookingFees.listingPriceNum(ev);
    return eventTicketPrice(ev);
  }

  function parsePriceInput(el) {
    if (!el) return null;
    var raw = String(el.value || '').trim();
    if (!raw) return null;
    var n = Math.round(Number(raw));
    return Number.isNaN(n) || n < 0 ? null : n;
  }

  function getPriceBounds() {
    return {
      minVal: parsePriceInput(priceMinInput),
      maxVal: parsePriceInput(priceMaxInput),
    };
  }

  function onPriceInputChange() {
    applyFilters();
  }

  function syncPriceInputs() {
    var bounds = getPriceBounds();
    if (
      bounds.minVal != null &&
      bounds.maxVal != null &&
      bounds.minVal > bounds.maxVal
    ) {
      if (priceMaxInput) priceMaxInput.value = String(bounds.minVal);
    }
  }

  function getLocationRadiusMiles() {
    var el = locationRadius;
    var n = el ? Number(el.value) : 15;
    return n === 5 || n === 15 || n === 25 || n === 50 ? n : 15;
  }

  /** True when the location query has an outcode/city sector list (prefer that over miles). */
  function locationHasOutcodeFilter(pc) {
    if (!pc || !window.hubAllowedOutcodesForQuery) return false;
    var outcodes = window.hubAllowedOutcodesForQuery(pc);
    return !!(outcodes && outcodes.length);
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

  function loadProfileLocation() {
    if (!window.hubFetchSession) return Promise.resolve('');
    return window
      .hubFetchSession()
      .then(function (session) {
        if (!session || !session.ok) return '';
        return fetch('/api/auth/profile', { credentials: 'include' })
          .then(function (res) {
            return res.json();
          })
          .then(function (data) {
            if (data.ok && data.profile) {
              window.hubProfileLocation = String(data.profile.location || '').trim();
            }
            return window.hubProfileLocation || '';
          })
          .catch(function () {
            return '';
          });
      })
      .catch(function () {
        return '';
      });
  }

  window.hubLoadProfileLocation = loadProfileLocation;
  loadProfileLocation();

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
      // Wait for geolocation — do not hide in-person listings before coords exist.
      if (!window.hubUserCoords) return true;
      center = window.hubUserCoords;
      var nearCoords = eventCoords(ev);
      if (center && nearCoords && window.hubDistanceMiles) {
        return (
          window.hubDistanceMiles(center[0], center[1], nearCoords[0], nearCoords[1]) <=
          getLocationRadiusMiles()
        );
      }
      return !center;
    }

    // City names / outcodes (e.g. Birmingham, B1) match by sector — not a mile radius.
    if (pc && locationHasOutcodeFilter(pc) && window.hubMatchOutcode) {
      return window.hubMatchOutcode(pc, ev);
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

    return true;
  }

  function resolveLocationFilterCoords(value) {
    if (!value) {
      window.hubLocationFilterCoords = null;
      return Promise.resolve(null);
    }
    // Skip geocoding when we already have city/outcode sectors — avoids a 15–25mi override.
    if (locationHasOutcodeFilter(value)) {
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
    var profileLoc = String(window.hubProfileLocation || '').trim();
    if (profileLoc && window.hubGeocodeLocationQuery) {
      return window.hubGeocodeLocationQuery(profileLoc).then(function (coords) {
        if (coords) {
          window.hubUserCoords = coords;
          return coords;
        }
        return resolveDeviceGeolocation();
      });
    }
    return resolveDeviceGeolocation();
  }

  function resolveDeviceGeolocation() {
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
    resolveNearMeCoords().then(function () {
      if (window.hubServerBrowse && window.hubBrowseFetchNow) {
        window.hubBrowseFetchNow(1);
      } else {
        var all = window.hubAllEvents || [];
        var enrich = window.hubEnrichEventCoords ? window.hubEnrichEventCoords(all) : Promise.resolve();
        enrich.then(function () {
          applyFilters();
        });
      }
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
    var resolveFilter = window.hubResolveLocationFilter
      ? window.hubResolveLocationFilter(pc)
      : Promise.resolve();
    resolveFilter.then(function () {
      if (window.hubServerBrowse && window.hubBrowseFetchNow) {
        window.hubBrowseFetchNow(1);
      } else {
        var all = window.hubAllEvents || [];
        var enrich = window.hubEnrichEventCoords ? window.hubEnrichEventCoords(all) : Promise.resolve();
        enrich.then(function () {
          applyFilters();
        });
      }
    });
  }

  function eventCoords(ev) {
    if (ev.mapLat != null && ev.mapLng != null) return [ev.mapLat, ev.mapLng];
    if (Number.isFinite(ev.lat) && Number.isFinite(ev.lng)) return [ev.lat, ev.lng];
    return null;
  }

  function eventShowsFiveStars(ev) {
    var reviews = Number(ev.reviews) || 0;
    var rating = Number(ev.rating);
    if (reviews <= 0 || Number.isNaN(rating)) return false;
    return Math.round(rating) >= 5;
  }

  function eventMatchesFilters(ev) {
    if (!isUpcomingBrowseEvent(ev)) return false;

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
    var listingPrice = eventListingPrice(ev);
    if (bounds.minVal != null && listingPrice < bounds.minVal) return false;
    if (bounds.maxVal != null && listingPrice > bounds.maxVal) return false;

    if (checkFiveStarsOnly && checkFiveStarsOnly.checked && !eventShowsFiveStars(ev)) {
      return false;
    }

    return true;
  }

  function eventRatingSortKey(ev) {
    var reviews = Number(ev.reviews) || 0;
    var rating = Number(ev.rating);
    if (reviews <= 0 || Number.isNaN(rating)) return null;
    return rating;
  }

  function sortEvents(list) {
    var sort = (sortSelect && sortSelect.value) || 'recommended';
    var copy = list.slice();
    copy.sort(function (a, b) {
      if (sort === 'rating' || sort === 'rating-desc') {
        var rb = eventRatingSortKey(b);
        var ra = eventRatingSortKey(a);
        if (ra == null && rb == null) return 0;
        if (ra == null) return 1;
        if (rb == null) return -1;
        return rb - ra;
      }
      if (sort === 'rating-asc') {
        var raAsc = eventRatingSortKey(a);
        var rbAsc = eventRatingSortKey(b);
        if (raAsc == null && rbAsc == null) return 0;
        if (raAsc == null) return 1;
        if (rbAsc == null) return -1;
        return raAsc - rbAsc;
      }
      if (sort === 'price' || sort === 'price-asc') {
        return eventListingPrice(a) - eventListingPrice(b);
      }
      if (sort === 'price-desc') {
        return eventListingPrice(b) - eventListingPrice(a);
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

  function syncBrowseDateParams() {
    window.hubBrowseDateFrom = dateFromTs ? new Date(dateFromTs).toISOString() : '';
    window.hubBrowseDateTo = dateToTs ? new Date(dateToTs).toISOString() : '';
  }

  function applyFilters(options) {
    options = options || {};
    if (document.body.classList.contains('browse-mode-organisers')) {
      if (window.hubApplyOrganiserFilters) window.hubApplyOrganiserFilters();
      return;
    }
    if (window.hubServerBrowse && (window.hubBrowseFetchDebounced || window.hubBrowseFetchNow)) {
      window.hubBrowseCurrentPage = 1;
      if (options.immediate && window.hubBrowseFetchNow) {
        window.hubBrowseFetchNow(1);
      } else if (window.hubBrowseFetchDebounced) {
        window.hubBrowseFetchDebounced(1);
      }
      saveFilterPrefs();
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
          fiveStarsOnly: !!(checkFiveStarsOnly && checkFiveStarsOnly.checked),
          inPerson: !!(checkInPerson && checkInPerson.checked),
          online: !!(checkOnline && checkOnline.checked),
          priceMin: priceMinInput ? priceMinInput.value : '',
          priceMax: priceMaxInput ? priceMaxInput.value : '',
          sort: sortSelect ? sortSelect.value : 'recommended',
          typeTabs: activeTypeTabs.slice(),
        })
      );
    } catch (e) {
      /* ignore */
    }
  }

  function getUrlSearchQuery() {
    try {
      return String(new URLSearchParams(location.search).get('q') || '').trim();
    } catch (e) {
      return '';
    }
  }

  function getUrlFormatFilter() {
    try {
      return String(new URLSearchParams(location.search).get('format') || '').trim().toLowerCase();
    } catch (e) {
      return '';
    }
  }

  function applyOnlineFormatFilter() {
    if (checkInPerson) checkInPerson.checked = false;
    if (checkOnline) checkOnline.checked = true;
    if (postcodeInput) postcodeInput.value = '';
    if (toggleNearMe) toggleNearMe.checked = false;
    if (toggleNearMeMobile) toggleNearMeMobile.checked = false;
    window.hubLocationFilterState = null;
    window.hubLocationFilterCoords = null;
    syncNearRadiusUi();
  }

  var pendingResultsScroll = false;

  function shouldScrollToBrowseResults() {
    try {
      if (location.hash === '#results' || location.hash === '#listings') return true;
      return !!getUrlSearchQuery();
    } catch (e) {
      return false;
    }
  }

  function scrollToBrowseResults() {
    var target = document.getElementById('events-results');
    if (!target) return;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  }

  pendingResultsScroll = shouldScrollToBrowseResults();

  window.hubGetUrlSearchQuery = getUrlSearchQuery;
  window.hubScrollToBrowseResults = scrollToBrowseResults;
  window.hubConsumePendingResultsScroll = function () {
    if (!pendingResultsScroll) return false;
    pendingResultsScroll = false;
    scrollToBrowseResults();
    return true;
  };

  function restoreFilterPrefs() {
    try {
      var urlQ = getUrlSearchQuery();
      var regional = window.hubRegionalLanding;

      if (regional && regional.location) {
        if (searchInput && urlQ) searchInput.value = urlQ;
        if (postcodeInput) postcodeInput.value = regional.location;
        if (checkInPerson) checkInPerson.checked = true;
        if (checkOnline) checkOnline.checked = true;
        if (toggleNearMe) toggleNearMe.checked = false;
        if (toggleNearMeMobile) toggleNearMeMobile.checked = false;
        syncNearRadiusUi();
        return window.hubResolveLocationFilter
          ? window.hubResolveLocationFilter(regional.location)
          : Promise.resolve();
      }

      if (urlQ) {
        if (searchInput) searchInput.value = urlQ;
        // Homepage / shared search links should not inherit stale session filters.
        return Promise.resolve();
      }

      if (getUrlFormatFilter() === 'online') {
        applyOnlineFormatFilter();
        return Promise.resolve();
      }

      var raw = sessionStorage.getItem(FILTER_STORAGE_KEY);
      if (!raw) {
        return Promise.resolve();
      }
      var prefs = JSON.parse(raw);
      if (searchInput && prefs.search) searchInput.value = prefs.search;
      if (postcodeInput && prefs.postcode) postcodeInput.value = prefs.postcode;
      if (checkFreeOnly) checkFreeOnly.checked = !!prefs.freeOnly;
      if (checkFiveStarsOnly) checkFiveStarsOnly.checked = !!prefs.fiveStarsOnly;
      if (checkInPerson && prefs.inPerson === false) checkInPerson.checked = false;
      if (checkOnline && prefs.online === false) checkOnline.checked = false;
      if (priceMinInput && prefs.priceMin) priceMinInput.value = prefs.priceMin;
      if (priceMaxInput && prefs.priceMax) priceMaxInput.value = prefs.priceMax;
      if (sortSelect && prefs.sort) sortSelect.value = prefs.sort;
      if (toggleNearMe) toggleNearMe.checked = !!prefs.nearMe;
      if (toggleNearMeMobile) toggleNearMeMobile.checked = !!prefs.nearMe;
      var restoredRadius = prefs.locationRadius || prefs.nearRadius;
      if (locationRadius && restoredRadius) locationRadius.value = restoredRadius;
      if (nearRadius && restoredRadius) nearRadius.value = restoredRadius;
      if (nearRadiusMobile && restoredRadius) nearRadiusMobile.value = restoredRadius;
      if (Array.isArray(prefs.typeTabs)) {
        activeTypeTabs = prefs.typeTabs.map(normalizeTypeTabSlug).filter(function (slug) {
          return slug && slug !== 'all';
        });
        window.hubBrowseActiveTypeTabs = activeTypeTabs.slice();
        syncTypeChipUi();
      } else if (prefs.typeTab) {
        setActiveTypeTab(normalizeTypeTabSlug(prefs.typeTab));
      }
      syncNearRadiusUi();
      if (postcodeInput && prefs.postcode) {
        var restorePc = prefs.postcode;
        var resolveFilter = window.hubResolveLocationFilter
          ? window.hubResolveLocationFilter(restorePc)
          : Promise.resolve();
        return resolveFilter.then(function () {
          return resolveLocationFilterCoords(restorePc);
        }).then(function () {
          syncNearRadiusUi();
        });
      }
    } catch (e) {
      /* ignore */
    }
    return Promise.resolve();
  }

  window.hubRestoreEventFilterPrefs = function (options) {
    options = options || {};
    return restoreFilterPrefs().then(function () {
      if (options.prepareOnly) return;
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
      resolveFilter
        .then(function () {
          return resolveLocationFilterCoords(value);
        })
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

  function hasExtraFiltersBeyondRegional() {
    if (searchInput && String(searchInput.value || '').trim()) return true;
    if (dateFromTs || dateToTs) return true;
    if (checkFreeOnly && checkFreeOnly.checked) return true;
    if (checkFiveStarsOnly && checkFiveStarsOnly.checked) return true;
    if (priceMinInput && String(priceMinInput.value || '').trim()) return true;
    if (priceMaxInput && String(priceMaxInput.value || '').trim()) return true;
    if (activeTypeTabs && activeTypeTabs.length) return true;
    if (isNearMeActive()) return true;
    if (checkInPerson && !checkInPerson.checked) return true;
    if (checkOnline && !checkOnline.checked) return true;
    if (sortSelect && sortSelect.value && sortSelect.value !== 'recommended') return true;
    return false;
  }

  function resetFilters() {
    var regional = window.hubRegionalLanding;
    // Regional pages lock location to the city. If that is the only constraint,
    // "clear filters" must leave the landing — otherwise the UI looks broken.
    if (regional && regional.location && !hasExtraFiltersBeyondRegional()) {
      window.location.href = '/events/';
      return;
    }

    if (searchInput) searchInput.value = '';
    if (postcodeInput) {
      postcodeInput.value = regional && regional.location ? regional.location : '';
    }
    if (sortSelect) sortSelect.value = 'recommended';
    if (flatpickrInstance) flatpickrInstance.clear();
    syncDateWrapState([]);
    dateFromTs = null;
    dateToTs = null;
    syncBrowseDateParams();
    if (checkInPerson) checkInPerson.checked = true;
    if (checkOnline) checkOnline.checked = true;
    if (checkFreeOnly) checkFreeOnly.checked = false;
    if (checkFiveStarsOnly) checkFiveStarsOnly.checked = false;
    if (priceMinInput) priceMinInput.value = '';
    if (priceMaxInput) priceMaxInput.value = '';
    if (toggleNearMe) toggleNearMe.checked = false;
    if (toggleNearMeMobile) toggleNearMeMobile.checked = false;
    if (locationRadius) locationRadius.value = '15';
    if (nearRadius) nearRadius.value = '15';
    if (nearRadiusMobile) nearRadiusMobile.value = '15';
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

    if (regional && regional.location && window.hubResolveLocationFilter) {
      window.hubResolveLocationFilter(regional.location).then(function () {
        applyFilters({ immediate: true });
      });
      return;
    }
    applyFilters({ immediate: true });
  }

  function setActiveTypeTab(type) {
    activeTypeTabs = [];
    if (type && type !== 'all') activeTypeTabs = [type];
    window.hubBrowseActiveTypeTabs = activeTypeTabs.slice();
    syncTypeChipUi();
  }

  window.hubUpdateEventTypeChipCounts = function () {
    var counts = window.hubBrowseTypeCounts;
    typeTabs = document.querySelectorAll('.event-type-chip[data-type]');
    typeTabs.forEach(function (chip) {
      var type = chip.getAttribute('data-type') || 'all';
      var countEl = chip.querySelector('.event-type-chip-count');
      if (!countEl) return;
      var count;
      if (window.hubServerBrowse) {
        if (counts) {
          count = type === 'all' ? counts.all || 0 : counts[type] || 0;
        } else if (type === 'all' && window.hubBrowseTotal != null) {
          count = Number(window.hubBrowseTotal) || 0;
        } else {
          return;
        }
      } else if (counts) {
        count = type === 'all' ? counts.all || 0 : counts[type] || 0;
      } else {
        var all = window.hubAllEvents || [];
        var list =
          type === 'all'
            ? window.hubGetFilteredEvents(all, { typeTab: 'all' })
            : window.hubGetFilteredEvents(all, { typeTabs: [type] });
        count = list.length;
      }
      countEl.textContent = '(' + count + ')';
      chip.classList.toggle('is-zero', count === 0);
    });
  };

  window.hubApplyFilters = applyFilters;
  window.hubResetFilters = resetFilters;
  window.hubSetTypeTab = setActiveTypeTab;
  window.hubGetActiveTypeTabs = function () {
    return activeTypeTabs.slice();
  };

  window.hubSpotlightLocationLabel = function () {
    if (window.hubIsNearMeActive && window.hubIsNearMeActive()) {
      var miles = window.hubLocationRadiusMiles ? window.hubLocationRadiusMiles() : 15;
      return 'near you (' + miles + ' mi)';
    }
    var pc = postcodeInput ? String(postcodeInput.value || '').trim() : '';
    if (pc) return pc;
    var regional = window.hubRegionalLanding;
    if (regional && regional.name) return String(regional.name).trim();
    return '';
  };

  window.hubSpotlightRefinementFiltersActive = function () {
    var typeActive = activeTypeTabs.length > 0;
    var freeOnly = !!(checkFreeOnly && checkFreeOnly.checked);
    var priceMax = !!(priceMaxInput && String(priceMaxInput.value || '').trim() !== '');
    var searchQ = searchInput ? String(searchInput.value || '').trim() : '';
    return {
      type: typeActive,
      freeOnly: freeOnly,
      priceMax: priceMax,
      search: !!searchQ,
      any: typeActive || freeOnly || priceMax,
    };
  };

  window.hubSpotlightHasLocationFilter = function () {
    if (window.hubIsNearMeActive && window.hubIsNearMeActive()) return true;
    var pc = postcodeInput ? String(postcodeInput.value || '').trim() : '';
    if (pc) return true;
    return !!(window.hubRegionalLanding && window.hubRegionalLanding.location);
  };

  window.hubClearSpotlightLocationFilter = function () {
    var regional = window.hubRegionalLanding;
    if (regional && regional.location) {
      window.location.href = '/events/';
      return;
    }
    if (postcodeInput) postcodeInput.value = '';
    if (toggleNearMe) toggleNearMe.checked = false;
    if (toggleNearMeMobile) toggleNearMeMobile.checked = false;
    window.hubUserCoords = null;
    window.hubLocationFilterState = null;
    window.hubLocationFilterCoords = null;
    syncNearRadiusUi();
    applyFilters({ immediate: true });
  };
  window.hubFilterServerBrowseEvents = function (list) {
    // Drop events that have already started — server should filter too, but
    // keep this as a safety net for cached API responses.
    return (list || []).filter(isUpcomingBrowseEvent);
  };
  window.hubIsNearMeActive = isNearMeActive;
  window.hubNearRadiusMiles = getNearRadiusMiles;
  window.hubLocationRadiusMiles = getLocationRadiusMiles;

  function bindFilter(el) {
    if (!el) return;
    el.addEventListener('input', applyFilters);
    el.addEventListener('change', applyFilters);
  }

  [searchInput, sortSelect, checkInPerson, checkOnline, checkFreeOnly, checkFiveStarsOnly].forEach(bindFilter);

  [priceMinInput, priceMaxInput].forEach(function (el) {
    if (!el) return;
    el.addEventListener('input', function () {
      syncPriceInputs();
      onPriceInputChange();
    });
    el.addEventListener('change', function () {
      syncPriceInputs();
      onPriceInputChange();
    });
  });

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
    if (locationRadiusTimer) clearTimeout(locationRadiusTimer);
    locationRadiusTimer = setTimeout(function () {
      locationRadiusTimer = null;
      applyLocationFilters();
    }, 280);
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

  function bindClearFilters(btn) {
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (document.body.classList.contains('browse-mode-organisers')) {
        if (window.hubResetOrganiserFilters) window.hubResetOrganiserFilters();
        return;
      }
      resetFilters();
    });
  }

  bindClearFilters(document.getElementById('clear-filters'));
  bindClearFilters(document.getElementById('clear-filters-bar'));
  bindClearFilters(document.getElementById('events-map-clear-filters'));

  document.addEventListener('click', function (e) {
    var emptyReset = e.target.closest && e.target.closest('#empty-reset');
    if (emptyReset) {
      e.preventDefault();
      if (document.body.classList.contains('browse-mode-organisers')) {
        if (window.hubResetOrganiserFilters) window.hubResetOrganiserFilters();
      } else {
        resetFilters();
      }
      return;
    }
    var fav = e.target.closest('.fav-btn[data-event-id]');
    if (fav) {
      e.preventDefault();
      e.stopPropagation();
      var eventId = fav.getAttribute('data-event-id');
      var organiserId = fav.getAttribute('data-organiser-id');
      if (window.HubFavourites && eventId) {
        window.HubFavourites.toggle(eventId, { organiserId: organiserId }).then(function () {
          window.HubFavourites.refreshButtons();
          if (window.HubOrganiserFavourites) window.HubOrganiserFavourites.refreshButtons();
        });
      } else {
        fav.classList.toggle('is-active');
      }
      return;
    }
    var orgFav = e.target.closest('.fav-btn[data-organiser-id]');
    if (orgFav) {
      e.preventDefault();
      e.stopPropagation();
      var organiserId = orgFav.getAttribute('data-organiser-id');
      if (window.HubOrganiserFavourites && organiserId) {
        window.HubOrganiserFavourites.toggle(organiserId).then(function () {
          window.HubOrganiserFavourites.refreshButtons();
        });
      } else {
        orgFav.classList.toggle('is-active');
      }
    }
  });

  var dateWrap = dateRangeInput && dateRangeInput.closest('.filter-date-wrap');

  function syncDateWrapState(selectedDates) {
    if (!dateWrap) return;
    dateWrap.classList.toggle('is-active', Boolean(selectedDates && selectedDates.length));
  }

  function initFlatpickr() {
    if (flatpickrInstance || !dateRangeInput || typeof flatpickr === 'undefined') return;
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
          syncBrowseDateParams();
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
        syncBrowseDateParams();
        applyFilters();
      },
      onClose: function (selectedDates) {
        if (selectedDates.length === 1) {
          var end = new Date(selectedDates[0]);
          end.setHours(23, 59, 59, 999);
          dateToTs = end.getTime();
          syncBrowseDateParams();
          applyFilters();
        }
      },
    });
  }

  function ensureFlatpickr(callback) {
    if (typeof flatpickr !== 'undefined') {
      initFlatpickr();
      if (callback) callback();
      return;
    }
    var load = window.hubLoadFlatpickr ? window.hubLoadFlatpickr() : Promise.resolve();
    load
      .then(function () {
        initFlatpickr();
        if (callback) callback();
      })
      .catch(function () {
        /* date filter is optional */
      });
  }

  function openDatePicker() {
    ensureFlatpickr(function () {
      if (flatpickrInstance) flatpickrInstance.open();
    });
  }

  if (dateWrap) {
    dateWrap.addEventListener('click', function (e) {
      if (e.target.closest('.flatpickr-calendar')) return;
      openDatePicker();
    });
  }

  if (dateRangeInput) {
    dateRangeInput.addEventListener('focus', function () {
      openDatePicker();
    });
  }

  if (location.hash === '#exhibitions' || location.search.indexOf('type=exhibition') !== -1) {
    setActiveTypeTab('exhibition');
  } else if (
    location.hash === '#conferences' ||
    location.search.indexOf('type=conference') !== -1
  ) {
    setActiveTypeTab('conference');
  } else if (location.hash === '#awards' || location.search.indexOf('type=awards') !== -1) {
    setActiveTypeTab('awards');
  } else if (location.hash === '#events' || location.search.indexOf('type=events') !== -1) {
    setActiveTypeTab('events');
  } else if (
    location.hash === '#meetings' ||
    location.hash === '#netwalking' ||
    location.search.indexOf('type=meeting') !== -1 ||
    location.search.indexOf('type=netwalking') !== -1 ||
    location.search.indexOf('type=networking-meeting') !== -1
  ) {
    setActiveTypeTab('meeting');
  }
})();
