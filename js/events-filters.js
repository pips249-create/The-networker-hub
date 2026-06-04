(function () {
  var searchInput = document.getElementById('search');
  var postcodeInput = document.getElementById('postcode');
  var typeSelect = document.getElementById('filter-type');
  var sortSelect = document.getElementById('sort');
  var dateRangeInput = document.getElementById('date-range');
  var checkInPerson = document.getElementById('check-inperson');
  var checkOnline = document.getElementById('check-online');
  var toggleNearMe = document.getElementById('toggle-nearme');
  var priceMinInput = document.getElementById('price-min');
  var priceMaxInput = document.getElementById('price-max');
  var priceRangeMax = document.getElementById('price-range-max');
  var priceTrigger = document.getElementById('price-trigger');
  var priceWrap = document.getElementById('price-filter-wrap');
  var priceApply = document.getElementById('price-apply');
  var resultsCount = document.getElementById('results-count');
  var spotlightPrev = document.getElementById('spotlight-prev');
  var spotlightNext = document.getElementById('spotlight-next');
  var spotlightTrack = document.getElementById('spotlight-track');
  var mapViewBtn = document.getElementById('map-view-btn');
  var mapViewLabel = document.getElementById('map-view-label');

  var pricePanelOpen = false;
  var priceFilterActive = false;
  var dateFromTs = null;
  var dateToTs = null;
  var flatpickrInstance = null;

  function getActiveType() {
    return typeSelect ? typeSelect.value || 'all' : 'all';
  }

  function eventMatchesFilters(ev) {
    var type = getActiveType();
    if (type !== 'all') {
      var slug = ev.typeSlug || '';
      if (slug !== type) return false;
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
    var nearMe = toggleNearMe && toggleNearMe.checked;

    if (nearMe && pc && window.hubUserCoords && window.hubDistanceMiles) {
      if (ev.mapLat == null || ev.mapLng == null) return false;
      var miles = window.hubDistanceMiles(
        window.hubUserCoords[0],
        window.hubUserCoords[1],
        ev.mapLat,
        ev.mapLng
      );
      if (miles > 35) return false;
    } else if (pc) {
      var compact = pc.toLowerCase().replace(/\s+/g, '');
      var locHay = [ev.location, ev.postcode, ev.venue, ev.search]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      var locCompact = locHay.replace(/\s/g, '');
      if (locHay.indexOf(pc.toLowerCase()) === -1 && locCompact.indexOf(compact) === -1) {
        return false;
      }
    }

    var wantInPerson = checkInPerson && checkInPerson.checked;
    var wantOnline = checkOnline && checkOnline.checked;
    var fmt = ev.formatSlug || '';
    if (wantInPerson && !wantOnline) {
      if (fmt && fmt !== 'in-person' && fmt !== 'hybrid') return false;
    } else if (wantOnline && !wantInPerson) {
      if (fmt && fmt !== 'online' && fmt !== 'hybrid') return false;
    } else if (!wantInPerson && !wantOnline) {
      return false;
    }

    if (dateFromTs || dateToTs) {
      var evTs =
        ev.dateTs != null
          ? ev.dateTs
          : ev.dateRaw
            ? new Date(ev.dateRaw).getTime()
            : null;
      if (evTs == null || Number.isNaN(evTs)) return false;
      if (dateFromTs && evTs < dateFromTs) return false;
      if (dateToTs && evTs > dateToTs) return false;
    }

    if (priceFilterActive) {
      var minP = priceMinInput ? parseFloat(priceMinInput.value) : 0;
      var maxRaw = priceMaxInput ? priceMaxInput.value : '';
      var maxP = maxRaw === '' ? Infinity : parseFloat(maxRaw);
      if (!Number.isFinite(minP)) minP = 0;
      if (!Number.isFinite(maxP)) maxP = Infinity;
      var p = Number(ev.priceNum);
      if (!Number.isFinite(p)) p = ev.priceKey === 'free' ? 0 : 0;
      if (p < minP) return false;
      if (p > maxP) return false;
    }

    return true;
  }

  function eventDateTs(ev) {
    if (ev.dateTs != null && !Number.isNaN(ev.dateTs)) return ev.dateTs;
    if (ev.dateRaw) {
      var t = new Date(ev.dateRaw).getTime();
      return Number.isNaN(t) ? null : t;
    }
    return null;
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

  window.hubGetFilteredEvents = function (all) {
    var list = (all || window.hubAllEvents || []).filter(eventMatchesFilters);
    return sortEvents(list);
  };

  function updatePriceLabel() {
    if (!priceTrigger) return;
    if (!priceFilterActive) {
      priceTrigger.textContent = 'Any price';
      return;
    }
    var min = priceMinInput ? priceMinInput.value : '0';
    var maxRaw = priceMaxInput ? priceMaxInput.value : '';
    if (maxRaw === '') {
      priceTrigger.textContent = '£' + min + '+';
      return;
    }
    if (min === maxRaw) {
      priceTrigger.textContent = '£' + min;
      return;
    }
    priceTrigger.textContent = '£' + min + ' – £' + maxRaw;
  }

  function applyFilters() {
    var all = window.hubAllEvents || [];
    var filtered = window.hubGetFilteredEvents(all);

    if (resultsCount) resultsCount.textContent = String(filtered.length);

    if (window.hubRefreshListings) window.hubRefreshListings();
    if (window.hubRefreshMap) window.hubRefreshMap(filtered);
  }

  function maybeGeocodeUserPostcode() {
    var pc = (postcodeInput && postcodeInput.value) || '';
    pc = pc.trim();
    if (!pc || !window.hubGeocodeUserPostcode) return;
    window.hubGeocodeUserPostcode(pc).then(applyFilters);
  }

  function resetFilters() {
    if (searchInput) searchInput.value = '';
    if (postcodeInput) postcodeInput.value = '';
    if (typeSelect) typeSelect.value = 'all';
    if (sortSelect) sortSelect.value = 'recommended';
    if (flatpickrInstance) flatpickrInstance.clear();
    dateFromTs = null;
    dateToTs = null;
    if (checkInPerson) checkInPerson.checked = true;
    if (checkOnline) checkOnline.checked = true;
    if (toggleNearMe) toggleNearMe.checked = false;
    if (priceMinInput) priceMinInput.value = '0';
    if (priceMaxInput) priceMaxInput.value = '';
    if (priceRangeMax) priceRangeMax.value = '200';
    priceFilterActive = false;
    updatePriceLabel();
    applyFilters();
  }

  window.hubApplyFilters = applyFilters;
  window.hubResetFilters = resetFilters;

  function bindFilter(el) {
    if (!el) return;
    el.addEventListener('input', applyFilters);
    el.addEventListener('change', applyFilters);
  }

  [
    searchInput,
    typeSelect,
    sortSelect,
    checkInPerson,
    checkOnline,
  ].forEach(bindFilter);

  if (postcodeInput) {
    postcodeInput.addEventListener('input', function () {
      maybeGeocodeUserPostcode();
      applyFilters();
    });
    postcodeInput.addEventListener('change', function () {
      maybeGeocodeUserPostcode();
      applyFilters();
    });
  }
  if (toggleNearMe) {
    toggleNearMe.addEventListener('change', function () {
      maybeGeocodeUserPostcode();
      applyFilters();
    });
  }

  if (priceApply) {
    priceApply.addEventListener('click', function () {
      priceFilterActive = true;
      pricePanelOpen = false;
      if (priceWrap) priceWrap.classList.remove('is-open');
      updatePriceLabel();
      applyFilters();
    });
  }

  if (priceMinInput) {
    priceMinInput.addEventListener('input', function () {
      if (priceFilterActive) applyFilters();
    });
  }
  if (priceMaxInput) {
    priceMaxInput.addEventListener('input', function () {
      if (priceFilterActive) {
        updatePriceLabel();
        applyFilters();
      }
    });
  }

  if (priceRangeMax && priceMaxInput) {
    priceRangeMax.addEventListener('input', function () {
      priceMaxInput.value = priceRangeMax.value;
      if (priceFilterActive) {
        updatePriceLabel();
        applyFilters();
      }
    });
  }

  if (priceTrigger && priceWrap) {
    priceTrigger.addEventListener('click', function () {
      pricePanelOpen = !pricePanelOpen;
      priceWrap.classList.toggle('is-open', pricePanelOpen);
      priceTrigger.setAttribute('aria-expanded', pricePanelOpen ? 'true' : 'false');
    });
    document.addEventListener('click', function (e) {
      if (!priceWrap.contains(e.target)) {
        pricePanelOpen = false;
        priceWrap.classList.remove('is-open');
        priceTrigger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  var clearBtn = document.getElementById('clear-filters');
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      priceFilterActive = false;
      resetFilters();
    });
  }

  document.addEventListener('click', function (e) {
    if (e.target.id === 'empty-reset') resetFilters();
    var fav = e.target.closest('.fav-btn');
    if (fav) {
      e.preventDefault();
      e.stopPropagation();
      fav.classList.toggle('is-active');
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

  if (mapViewBtn && window.hubToggleMapView) {
    mapViewBtn.addEventListener('click', function () {
      window.hubToggleMapView();
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
      locale: { rangeSeparator: ' – ' },
      onChange: function (selectedDates) {
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
    if (typeSelect) typeSelect.value = 'exhibition';
  } else if (location.hash === '#meetings' || location.search.indexOf('type=meeting') !== -1) {
    if (typeSelect) typeSelect.value = 'meeting';
  }

  updatePriceLabel();
})();
