(function () {
  var searchInput = document.getElementById('search');
  var postcodeInput = document.getElementById('postcode');
  var sortSelect = document.getElementById('sort');
  var dateRangeInput = document.getElementById('date-range');
  var checkInPerson = document.getElementById('check-inperson');
  var checkOnline = document.getElementById('check-online');
  var priceMax = document.getElementById('price-max');
  var priceMaxOut = document.getElementById('price-max-out');
  var PRICE_SLIDER_MAX = 500;
  var toggleNearMe = document.getElementById('toggle-nearme');
  var nearRadius = document.getElementById('near-radius');
  var nearRadiusWrap = document.getElementById('near-radius-wrap');
  var toggleNearMeMobile = document.getElementById('toggle-nearme-mobile');
  var nearRadiusMobile = document.getElementById('near-radius-mobile');
  var nearRadiusWrapMobile = document.getElementById('near-radius-wrap-mobile');
  var resultsCount = document.getElementById('results-count');
  var spotlightPrev = document.getElementById('spotlight-prev');
  var spotlightNext = document.getElementById('spotlight-next');
  var spotlightTrack = document.getElementById('spotlight-track');
  var typeTabs = document.querySelectorAll('.type-tab[data-type]');

  var activeTypeTab = 'all';
  var dateFromTs = null;
  var dateToTs = null;
  var flatpickrInstance = null;

  function getActiveTypeTab() {
    return activeTypeTab || 'all';
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
    var cap = priceMax ? Number(priceMax.max) || PRICE_SLIDER_MAX : PRICE_SLIDER_MAX;
    if (isMax && n >= cap) return 'Any';
    return '£' + n;
  }

  function syncPriceOutputs() {
    if (priceMaxOut && priceMax) priceMaxOut.textContent = formatPriceLabel(priceMax.value, true);
  }

  function getPriceBounds() {
    var minVal = 0;
    var maxVal = priceMax ? Number(priceMax.value) : PRICE_SLIDER_MAX;
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
      var n = eventTicketPrice(ev);
      if (n > peak) peak = n;
    });
    var cap = PRICE_SLIDER_MAX;
    if (peak > cap) cap = Math.ceil(peak / 10) * 10;
    priceMax.max = String(cap);
    if (Number(priceMax.value) > cap || Number(priceMax.value) === PRICE_SLIDER_MAX) {
      priceMax.value = String(cap);
    }
    syncPriceOutputs();
  }

  window.hubInitPriceFilter = initPriceSliderMax;

  function getNearRadiusMiles() {
    var el =
      isMobileFilterLayout() && nearRadiusMobile ? nearRadiusMobile : nearRadius;
    var n = el ? Number(el.value) : 25;
    return n === 5 || n === 50 ? n : 25;
  }

  function isMobileFilterLayout() {
    return window.matchMedia('(max-width: 900px)').matches;
  }

  function syncNearControls(source) {
    if (source !== 'mobile') {
      if (toggleNearMeMobile && toggleNearMe) {
        toggleNearMeMobile.checked = toggleNearMe.checked;
      }
      if (nearRadiusMobile && nearRadius) {
        nearRadiusMobile.value = nearRadius.value;
      }
    }
    if (source !== 'desktop') {
      if (toggleNearMe && toggleNearMeMobile) {
        toggleNearMe.checked = toggleNearMeMobile.checked;
      }
      if (nearRadius && nearRadiusMobile) {
        nearRadius.value = nearRadiusMobile.value;
      }
    }
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
    var checked = isNearMeActive();
    var mobile = isMobileFilterLayout();

    if (nearRadiusWrap && nearRadius) {
      nearRadius.disabled = !checked;
      nearRadiusWrap.hidden = mobile || !checked;
    }
    if (nearRadiusWrapMobile && nearRadiusMobile) {
      nearRadiusMobile.disabled = false;
      nearRadiusWrapMobile.hidden = false;
    }
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
      applyFilters();
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

  function eventCoords(ev) {
    if (ev.mapLat != null && ev.mapLng != null) return [ev.mapLat, ev.mapLng];
    if (Number.isFinite(ev.lat) && Number.isFinite(ev.lng)) return [ev.lat, ev.lng];
    return null;
  }

  function eventMatchesFilters(ev) {
    var typeTab = getActiveTypeTab();
    if (typeTab !== 'all') {
      var category = ev.eventTypeCategory || 'meeting';
      if (category !== typeTab) return false;
    }

    var q = (searchInput && searchInput.value) || '';
    q = q.trim().toLowerCase();
    if (q) {
      var hay = ev.search || '';
      var terms = q.split(/\s+/).filter(Boolean);
      for (var i = 0; i < terms.length; i++) {
        if (hay.indexOf(terms[i]) === -1) return false;
      }
    }

    var pc = (postcodeInput && postcodeInput.value) || '';
    pc = pc.trim();
    if (pc) {
      if (window.hubMatchOutcode) {
        if (!window.hubMatchOutcode(pc, ev)) return false;
      } else if (window.hubParseOutcode) {
        var userOc = window.hubParseOutcode(pc);
        var eventOc = window.hubEventOutcode ? window.hubEventOutcode(ev) : '';
        if (userOc && eventOc && userOc !== eventOc) return false;
      }
    }

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

    var bounds = getPriceBounds();
    var ticketPrice = eventTicketPrice(ev);
    var cap = priceMax ? Number(priceMax.max) || PRICE_SLIDER_MAX : PRICE_SLIDER_MAX;
    if (ticketPrice < bounds.minVal) return false;
    if (bounds.maxVal < cap && ticketPrice > bounds.maxVal) return false;

    if (isNearMeActive()) {
      var userCoords = window.hubUserCoords;
      if (!userCoords) return false;
      var coords = eventCoords(ev);
      if (!coords) return false;
      if (window.hubDistanceMiles) {
        var miles = window.hubDistanceMiles(userCoords[0], userCoords[1], coords[0], coords[1]);
        if (miles > getNearRadiusMiles()) return false;
      }
    }

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
    var savedTab = activeTypeTab;
    if (options.typeTab != null) activeTypeTab = options.typeTab;
    var list = (all || window.hubAllEvents || []).filter(eventMatchesFilters);
    if (options.typeTab != null) activeTypeTab = savedTab;
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
  }

  function onPostcodeInput() {
    if (document.body.classList.contains('browse-mode-organisers')) return;
    if (isNearMeActive()) {
      applyNearMeFilters();
      return;
    }
    applyFilters();
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
    if (priceMax) {
      priceMax.value = priceMax.max || String(PRICE_SLIDER_MAX);
    }
    syncPriceOutputs();
    if (toggleNearMe) toggleNearMe.checked = false;
    if (toggleNearMeMobile) toggleNearMeMobile.checked = false;
    if (nearRadius) nearRadius.value = '25';
    if (nearRadiusMobile) nearRadiusMobile.value = '25';
    window.hubUserCoords = null;
    syncNearRadiusUi();
    setActiveTypeTab('all');
    applyFilters();
  }

  function setActiveTypeTab(type) {
    activeTypeTab = type || 'all';
    typeTabs.forEach(function (tab) {
      var active = tab.getAttribute('data-type') === activeTypeTab;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  window.hubApplyFilters = applyFilters;
  window.hubResetFilters = resetFilters;
  window.hubSetTypeTab = setActiveTypeTab;

  function bindFilter(el) {
    if (!el) return;
    el.addEventListener('input', applyFilters);
    el.addEventListener('change', applyFilters);
  }

  [searchInput, sortSelect, checkInPerson, checkOnline].forEach(bindFilter);

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
  if (nearRadius) {
    nearRadius.addEventListener('change', function () {
      syncNearControls('desktop');
      if (toggleNearMe && !toggleNearMe.checked) {
        toggleNearMe.checked = true;
        syncNearControls('desktop');
      }
      syncNearRadiusUi();
      applyNearMeFilters();
    });
  }
  if (nearRadiusMobile) {
    nearRadiusMobile.addEventListener('focus', function () {
      if (toggleNearMeMobile && !toggleNearMeMobile.checked) {
        toggleNearMeMobile.checked = true;
        syncNearControls('mobile');
        syncNearRadiusUi();
      }
    });
    nearRadiusMobile.addEventListener('change', function () {
      syncNearControls('mobile');
      if (toggleNearMeMobile && !toggleNearMeMobile.checked) {
        toggleNearMeMobile.checked = true;
        syncNearControls('mobile');
      }
      syncNearRadiusUi();
      applyNearMeFilters();
    });
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

  typeTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      if (document.body.classList.contains('browse-mode-organisers')) return;
      setActiveTypeTab(tab.getAttribute('data-type') || 'all');
      applyFilters();
    });
  });

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

  if (spotlightPrev && spotlightTrack) {
    spotlightPrev.addEventListener('click', function () {
      spotlightTrack.scrollBy({ left: -280, behavior: 'smooth' });
    });
  }
  if (spotlightNext && spotlightTrack) {
    spotlightNext.addEventListener('click', function () {
      spotlightTrack.scrollBy({ left: 280, behavior: 'smooth' });
    });
  }

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
  } else if (location.hash === '#meetings' || location.search.indexOf('type=meeting') !== -1) {
    setActiveTypeTab('meeting');
  }
})();
