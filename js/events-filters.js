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
  var cityPageCta = document.getElementById('filter-city-page-cta');

  var activeTypeTabs = [];
  var dateFromTs = null;
  var dateToTs = null;
  var flatpickrInstance = null;
  var locationResolveTimer = null;
  var locationRadiusTimer = null;
  var FILTER_STORAGE_KEY = 'hubEventBrowseFilters';
  var BROWSE_ALL_EVENTS_HREF = '/events/?browse=all';

  function isBrowseAllResetRequested() {
    try {
      return new URLSearchParams(window.location.search).get('browse') === 'all';
    } catch (e) {
      return false;
    }
  }

  function stripBrowseAllParam() {
    try {
      var url = new URL(window.location.href);
      if (url.searchParams.get('browse') !== 'all') return;
      url.searchParams.delete('browse');
      var query = url.searchParams.toString();
      var next = url.pathname + (query ? '?' + query : '') + url.hash;
      window.history.replaceState(null, '', next);
    } catch (e) {
      /* ignore */
    }
  }

  function clearStoredLocationFilters() {
    window.hubUserCoords = null;
    window.hubLocationFilterState = null;
    window.hubLocationFilterCoords = null;
    if (postcodeInput) postcodeInput.value = '';
    if (toggleNearMe) toggleNearMe.checked = false;
    if (toggleNearMeMobile) toggleNearMeMobile.checked = false;
    if (locationRadius) locationRadius.value = '15';
    if (nearRadius) nearRadius.value = '15';
    if (nearRadiusMobile) nearRadiusMobile.value = '15';
    try {
      var raw = sessionStorage.getItem(FILTER_STORAGE_KEY);
      if (raw) {
        var prefs = JSON.parse(raw);
        delete prefs.postcode;
        prefs.nearMe = false;
        prefs.locationRadius = '15';
        prefs.nearRadius = '15';
        sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(prefs));
      }
    } catch (e) {
      /* ignore */
    }
    syncNearRadiusUi();
  }

  window.hubBrowseAllEventsHref = BROWSE_ALL_EVENTS_HREF;

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
    if (window.hubPrefersGeoRadiusForLocation && window.hubPrefersGeoRadiusForLocation(pc)) {
      return false;
    }
    var outcodes = window.hubAllowedOutcodesForQuery(pc);
    return !!(outcodes && outcodes.length);
  }

  function getNearRadiusMiles() {
    return getLocationRadiusMiles();
  }

  function isLocationFilterDisabled() {
    return !!(checkInPerson && !checkInPerson.checked);
  }

  function syncLocationFieldForFormat() {
    var locationDisabled = isLocationFilterDisabled();
    var locationGroup = document.querySelector('.filter-bar-location-group');

    if (locationDisabled) {
      if (postcodeInput && postcodeInput.value) {
        postcodeInput.value = '';
        window.hubLocationFilterState = null;
        window.hubLocationFilterCoords = null;
      }
      if (toggleNearMe) toggleNearMe.checked = false;
      if (toggleNearMeMobile) toggleNearMeMobile.checked = false;
    }

    if (postcodeInput) postcodeInput.disabled = locationDisabled;
    if (locationRadius) {
      locationRadius.disabled =
        locationDisabled || !((postcodeInput && postcodeInput.value.trim()) || isNearMeActive());
    }
    if (toggleNearMe) toggleNearMe.disabled = locationDisabled;
    if (toggleNearMeMobile) toggleNearMeMobile.disabled = locationDisabled;
    if (locationGroup) locationGroup.classList.toggle('is-disabled', locationDisabled);

    if (!locationDisabled) syncNearRadiusUi();
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
    if (isLocationFilterDisabled()) {
      syncLocationFieldForFormat();
      return;
    }
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

  function updateCityPageCta() {
    if (!cityPageCta || document.body.classList.contains('browse-mode-organisers')) {
      if (cityPageCta) cityPageCta.hidden = true;
      return;
    }

    var text = '';
    if (postcodeInput && String(postcodeInput.value || '').trim()) {
      text = String(postcodeInput.value || '').trim();
    } else if (searchInput && String(searchInput.value || '').trim()) {
      text = String(searchInput.value || '').trim();
    }

    if (!text || !window.hubNetworkingRegionSlugFromInput || !window.HUB_getNetworkingRegion) {
      cityPageCta.hidden = true;
      return;
    }

    var slug = window.hubNetworkingRegionSlugFromInput(text);
    if (!slug) {
      cityPageCta.hidden = true;
      return;
    }

    var regional = window.hubRegionalLanding;
    if (regional && regional.slug === slug) {
      cityPageCta.hidden = true;
      return;
    }

    var meta = window.HUB_getNetworkingRegion(slug);
    if (!meta) {
      cityPageCta.hidden = true;
      return;
    }

    cityPageCta.href = window.HUB_networkingRegionPath
      ? window.HUB_networkingRegionPath(slug)
      : '/networking/' + encodeURIComponent(slug);
    cityPageCta.textContent = 'View ' + meta.name + ' networking hub →';
    cityPageCta.hidden = false;
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
      if (window.HUB_refreshNearYouChip) window.HUB_refreshNearYouChip();
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
    resolveFilter
      .then(function () {
        return resolveLocationFilterCoords(pc);
      })
      .then(function () {
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

  function eventAddedSortKey(ev) {
    var raw = ev.createdAt || ev.created_at || '';
    if (!raw) return null;
    var ts = new Date(raw).getTime();
    return Number.isNaN(ts) ? null : ts;
  }

  function sortEvents(list) {
    var sort = (sortSelect && sortSelect.value) || 'recommended';
    var copy = list.slice();
    copy.sort(function (a, b) {
      if (sort === 'best-rated' || sort === 'rating' || sort === 'rating-desc') {
        var rb = eventRatingSortKey(b);
        var ra = eventRatingSortKey(a);
        if (ra == null && rb == null) return 0;
        if (ra == null) return 1;
        if (rb == null) return -1;
        return rb - ra;
      }
      if (sort === 'newest-added') {
        var ca = eventAddedSortKey(a);
        var cb = eventAddedSortKey(b);
        if (ca == null && cb == null) return 0;
        if (ca == null) return 1;
        if (cb == null) return -1;
        return cb - ca;
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
    refreshMobileFilterToggleUi();
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
          dateFrom: dateFromTs ? new Date(dateFromTs).toISOString() : '',
          dateTo: dateToTs ? new Date(dateToTs).toISOString() : '',
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

  function getUrlTypeTab() {
    try {
      if (location.hash === '#exhibitions' || location.search.indexOf('type=exhibition') !== -1) {
        return 'exhibition';
      }
      if (location.hash === '#conferences' || location.search.indexOf('type=conference') !== -1) {
        return 'conference';
      }
      if (location.hash === '#awards' || location.search.indexOf('type=awards') !== -1) {
        return 'awards';
      }
      if (location.hash === '#events' || location.search.indexOf('type=events') !== -1) {
        return 'events';
      }
      if (
        location.hash === '#meetings' ||
        location.hash === '#netwalking' ||
        location.search.indexOf('type=meeting') !== -1 ||
        location.search.indexOf('type=netwalking') !== -1 ||
        location.search.indexOf('type=networking-meeting') !== -1
      ) {
        return 'meeting';
      }
    } catch (e) {
      return '';
    }
    return '';
  }

  function restoreDateFilterPrefs(prefs) {
    if (!prefs || (!prefs.dateFrom && !prefs.dateTo)) return;
    dateFromTs = prefs.dateFrom ? new Date(prefs.dateFrom).getTime() : null;
    dateToTs = prefs.dateTo ? new Date(prefs.dateTo).getTime() : null;
    if (dateFromTs != null && Number.isNaN(dateFromTs)) dateFromTs = null;
    if (dateToTs != null && Number.isNaN(dateToTs)) dateToTs = null;
    syncBrowseDateParams();
    ensureFlatpickr(function () {
      if (!flatpickrInstance || !dateFromTs) return;
      var dates = [new Date(dateFromTs)];
      if (dateToTs && dateToTs !== dateFromTs) dates.push(new Date(dateToTs));
      flatpickrInstance.setDate(dates, false);
      syncDateWrapState(dates);
    });
  }

  function resolveRestoredLocationFilter(postcode) {
    var restorePc = String(postcode || '').trim();
    if (!restorePc) return Promise.resolve();
    var resolveFilter = window.hubResolveLocationFilter
      ? window.hubResolveLocationFilter(restorePc)
      : Promise.resolve();
    return resolveFilter
      .then(function () {
        return resolveLocationFilterCoords(restorePc);
      })
      .then(function () {
        syncNearRadiusUi();
      });
  }

  function applyOnlineFormatFilter() {
    if (checkInPerson) checkInPerson.checked = false;
    if (checkOnline) checkOnline.checked = true;
    if (postcodeInput) postcodeInput.value = '';
    if (toggleNearMe) toggleNearMe.checked = false;
    if (toggleNearMeMobile) toggleNearMeMobile.checked = false;
    window.hubLocationFilterState = null;
    window.hubLocationFilterCoords = null;
    syncLocationFieldForFormat();
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
      if (isBrowseAllResetRequested()) {
        clearStoredLocationFilters();
        stripBrowseAllParam();
      }

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

      var urlTypeTab = getUrlTypeTab();
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
      syncLocationFieldForFormat();
      if (priceMinInput && prefs.priceMin) priceMinInput.value = prefs.priceMin;
      if (priceMaxInput && prefs.priceMax) priceMaxInput.value = prefs.priceMax;
      if (sortSelect && prefs.sort) sortSelect.value = prefs.sort;
      if (toggleNearMe) toggleNearMe.checked = !!prefs.nearMe;
      if (toggleNearMeMobile) toggleNearMeMobile.checked = !!prefs.nearMe;
      var restoredRadius = prefs.locationRadius || prefs.nearRadius;
      if (locationRadius && restoredRadius) locationRadius.value = restoredRadius;
      if (nearRadius && restoredRadius) nearRadius.value = restoredRadius;
      if (nearRadiusMobile && restoredRadius) nearRadiusMobile.value = restoredRadius;
      if (!urlTypeTab) {
        if (Array.isArray(prefs.typeTabs)) {
          activeTypeTabs = prefs.typeTabs.map(normalizeTypeTabSlug).filter(function (slug) {
            return slug && slug !== 'all';
          });
          window.hubBrowseActiveTypeTabs = activeTypeTabs.slice();
          syncTypeChipUi();
        } else if (prefs.typeTab) {
          setActiveTypeTab(normalizeTypeTabSlug(prefs.typeTab));
        }
      }
      restoreDateFilterPrefs(prefs);
      syncNearRadiusUi();
      if (isNearMeActive()) {
        return resolveNearMeCoords().then(function () {
          syncNearRadiusUi();
        });
      }
      if (postcodeInput && prefs.postcode) {
        return resolveRestoredLocationFilter(prefs.postcode);
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
    updateCityPageCta();
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
    var regional = window.hubRegionalLanding;
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
    if (regional && regional.location && postcodeInput) {
      var pc = String(postcodeInput.value || '').trim();
      if (pc && pc !== String(regional.location).trim()) return true;
    }
    return false;
  }

  function finishResetFilters() {
    syncLocationFieldForFormat();
    setActiveTypeTab('all');
    try {
      sessionStorage.removeItem(FILTER_STORAGE_KEY);
    } catch (e) {
      /* ignore */
    }
    applyFilters({ immediate: true });
  }

  function resetFilters() {
    var regional = window.hubRegionalLanding;
    // Regional pages lock location to the city. If that is the only constraint,
    // "clear filters" must leave the landing — otherwise the UI looks broken.
    if (regional && regional.location && !hasExtraFiltersBeyondRegional()) {
      window.location.href = BROWSE_ALL_EVENTS_HREF;
      return;
    }

    if (searchInput) searchInput.value = '';
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

    if (regional && regional.location) {
      if (postcodeInput) postcodeInput.value = regional.location;
      resolveRestoredLocationFilter(regional.location).then(finishResetFilters);
      return;
    }

    if (postcodeInput) postcodeInput.value = '';
    finishResetFilters();
  }

  function setActiveTypeTab(type) {
    activeTypeTabs = [];
    if (type && type !== 'all') activeTypeTabs = [type];
    window.hubBrowseActiveTypeTabs = activeTypeTabs.slice();
    syncTypeChipUi();
  }

  window.hubUpdateEventTypeChipCounts = function () {
    var counts = window.hubBrowseTypeCounts;
    var selectedTypes = activeTypeTabs.slice();
    typeTabs = document.querySelectorAll('.event-type-chip[data-type]');
    typeTabs.forEach(function (chip) {
      var type = chip.getAttribute('data-type') || 'all';
      var countEl = chip.querySelector('.event-type-chip-count');
      if (!countEl) return;
      var count;
      if (window.hubServerBrowse) {
        if (type === 'all') {
          /* Always show catalog total for All — not the active-type filtered total */
          if (counts && counts.all != null) {
            count = Number(counts.all) || 0;
          } else if (selectedTypes.length === 0 && window.hubBrowseTotal != null) {
            count = Number(window.hubBrowseTotal) || 0;
          } else {
            return;
          }
        } else if (counts) {
          count = counts[type] || 0;
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
      window.location.href = BROWSE_ALL_EVENTS_HREF;
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
    el.addEventListener('input', function () {
      if (el === searchInput) updateCityPageCta();
      applyFilters();
    });
    el.addEventListener('change', function () {
      if (el === searchInput) updateCityPageCta();
      applyFilters();
    });
  }

  function onFormatFilterChange() {
    syncLocationFieldForFormat();
    applyFilters();
  }

  [searchInput, sortSelect, checkFreeOnly, checkFiveStarsOnly].forEach(bindFilter);

  if (checkInPerson) checkInPerson.addEventListener('change', onFormatFilterChange);
  if (checkOnline) checkOnline.addEventListener('change', onFormatFilterChange);

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

  function initMobileFilterSheet() {
    var api = window.HUB_initMobileFilterSheet;
    if (!api) return;

    var controller = api({
      hasActiveFilters: function () {
        if (document.body.classList.contains('browse-mode-organisers')) {
          var orgListings = document.getElementById('org-has-listings');
          var orgGuest = document.getElementById('org-guest-visits');
          return !!(
            (orgListings && orgListings.checked) ||
            (orgGuest && orgGuest.checked)
          );
        }
        if (isNearMeActive()) return true;
        if (postcodeInput && String(postcodeInput.value || '').trim()) return true;
        if (dateFromTs || dateToTs) return true;
        if (checkFreeOnly && checkFreeOnly.checked) return true;
        if (checkFiveStarsOnly && checkFiveStarsOnly.checked) return true;
        if (checkInPerson && !checkInPerson.checked) return true;
        if (checkOnline && !checkOnline.checked) return true;
        if (priceMinInput && String(priceMinInput.value || '').trim()) return true;
        if (priceMaxInput && String(priceMaxInput.value || '').trim()) return true;
        return false;
      },
      getTitle: function () {
        return document.body.classList.contains('browse-mode-organisers')
          ? 'Filter organisers'
          : 'Filter events';
      },
      getApplyLabel: function () {
        var n = window.hubBrowseTotal;
        if (n == null && resultsCount) n = parseInt(String(resultsCount.textContent || ''), 10);
        n = Number(n);
        if (!isFinite(n) || n < 0) return 'Show results';
        return 'Show ' + n.toLocaleString('en-GB') + ' result' + (n === 1 ? '' : 's');
      },
      onApply: function () {
        applyFilters({ immediate: true });
      },
      onClear: function () {
        if (document.body.classList.contains('browse-mode-organisers')) {
          if (window.hubResetOrganiserFilters) window.hubResetOrganiserFilters();
        } else {
          resetFilters();
        }
      },
    });

    if (!controller) return;
    window.hubSyncMobileFilterToggle = controller.sync;
    window.hubOpenMobileFilterSheet = controller.open;
    window.hubCloseMobileFilterSheet = controller.close;
  }

  initMobileFilterSheet();

  function refreshMobileFilterToggleUi() {
    if (window.hubSyncMobileFilterToggle) window.hubSyncMobileFilterToggle();
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

  var urlTypeTab = getUrlTypeTab();
  if (urlTypeTab) {
    setActiveTypeTab(urlTypeTab);
  }

  syncLocationFieldForFormat();

  function initEventsFilterCitySearch() {
    if (!searchInput || !window.HUB_initNetworkingRegionSearch) return;
    var searchWrap = searchInput.closest('.filter-field-search');
    if (!searchWrap) return;
    window.HUB_initNetworkingRegionSearch(searchInput, searchWrap, {
      suggestClass: 'events-filter-search-suggest',
      preserveParams: ['mode'],
    });
  }

  function initEventsFilterLocationCitySearch() {
    if (!postcodeInput || !window.HUB_initNetworkingRegionSearch) return;
    var locationWrap = postcodeInput.closest('.filter-field-postcode');
    if (!locationWrap) return;
    window.HUB_initNetworkingRegionSearch(postcodeInput, locationWrap, {
      suggestClass: 'events-filter-search-suggest',
      preserveParams: ['mode'],
      isEnabled: function () {
        return !!(postcodeInput && !postcodeInput.disabled);
      },
      onNonCitySubmit: function () {
        applyLocationFilters();
      },
    });
  }

  initEventsFilterCitySearch();
  initEventsFilterLocationCitySearch();
  updateCityPageCta();
})();
