(function () {
  var searchInput = document.getElementById('search');
  var postcodeInput = document.getElementById('postcode');
  var typeSelect = document.getElementById('filter-type');
  var sortSelect = document.getElementById('sort');
  var dateFrom = document.getElementById('date-from');
  var dateTo = document.getElementById('date-to');
  var toggleInPerson = document.getElementById('toggle-inperson');
  var toggleOnline = document.getElementById('toggle-online');
  var toggleNearMe = document.getElementById('toggle-nearme');
  var priceMinInput = document.getElementById('price-min');
  var priceMaxInput = document.getElementById('price-max');
  var priceRangeMax = document.getElementById('price-range-max');
  var priceTrigger = document.getElementById('price-trigger');
  var priceWrap = document.getElementById('price-filter-wrap');
  var resultsCount = document.getElementById('results-count');
  var spotlightPrev = document.getElementById('spotlight-prev');
  var spotlightNext = document.getElementById('spotlight-next');
  var spotlightTrack = document.getElementById('spotlight-track');
  var mapViewBtn = document.getElementById('map-view-btn');

  var pricePanelOpen = false;

  function getActiveType() {
    return typeSelect ? typeSelect.value || 'all' : 'all';
  }

  function parseDateInput(val) {
    if (!val) return null;
    var d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }

  function eventMatchesFilters(ev) {
    var type = getActiveType();
    if (type !== 'all') {
      var cat = ev.typeCategory || ev.type;
      if (cat !== type) return false;
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
    pc = pc.trim().toLowerCase();
    if (pc) {
      var compact = pc.replace(/\s+/g, '');
      var locHay = [ev.location, ev.postcode, ev.venue, ev.search]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      var locCompact = locHay.replace(/\s/g, '');
      if (locHay.indexOf(pc) === -1 && locCompact.indexOf(compact) === -1) {
        return false;
      }
    }

    var wantInPerson = toggleInPerson && toggleInPerson.checked;
    var wantOnline = toggleOnline && toggleOnline.checked;
    var fmt = ev.formatSlug || '';
    if (wantInPerson && !wantOnline) {
      if (fmt && fmt !== 'in-person' && fmt !== 'hybrid') return false;
    } else if (wantOnline && !wantInPerson) {
      if (fmt && fmt !== 'online' && fmt !== 'hybrid') return false;
    } else if (!wantInPerson && !wantOnline) {
      return false;
    }

    var fromTs = dateFrom ? parseDateInput(dateFrom.value) : null;
    var toTs = dateTo ? parseDateInput(dateTo.value) : null;
    if (fromTs || toTs) {
      var evTs = ev.dateRaw ? new Date(ev.dateRaw).getTime() : null;
      if (!evTs) return false;
      if (fromTs && evTs < fromTs) return false;
      if (toTs) {
        var end = new Date(dateTo.value);
        end.setHours(23, 59, 59, 999);
        if (evTs > end.getTime()) return false;
      }
    }

    var minP = priceMinInput ? parseFloat(priceMinInput.value) : NaN;
    var maxP = priceMaxInput ? parseFloat(priceMaxInput.value) : NaN;
    if (!Number.isNaN(minP) && (Number(ev.priceNum) || 0) < minP) return false;
    if (!Number.isNaN(maxP) && maxP > 0 && (Number(ev.priceNum) || 0) > maxP) return false;

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
        var da = a.dateRaw ? new Date(a.dateRaw).getTime() : 0;
        var db = b.dateRaw ? new Date(b.dateRaw).getTime() : 0;
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da - db;
      }
      /* recommended: featured, rating, soonest date */
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      var ra = Number(a.rating) || 0;
      var rb = Number(b.rating) || 0;
      if (rb !== ra) return rb - ra;
      var d1 = a.dateRaw ? new Date(a.dateRaw).getTime() : Infinity;
      var d2 = b.dateRaw ? new Date(b.dateRaw).getTime() : Infinity;
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
    var min = priceMinInput ? priceMinInput.value : '0';
    var max = priceMaxInput ? priceMaxInput.value : '';
    if (!max || max === '0') {
      priceTrigger.textContent = 'Any price';
      return;
    }
    priceTrigger.textContent = '£' + min + ' – £' + max;
  }

  function applyFilters() {
    var all = window.hubAllEvents || [];
    var filtered = window.hubGetFilteredEvents(all);

    if (resultsCount) resultsCount.textContent = String(filtered.length);

    if (window.hubRefreshListings) window.hubRefreshListings();
  }

  function resetFilters() {
    if (searchInput) searchInput.value = '';
    if (postcodeInput) postcodeInput.value = '';
    if (typeSelect) typeSelect.value = 'all';
    if (sortSelect) sortSelect.value = 'recommended';
    if (dateFrom) dateFrom.value = '';
    if (dateTo) dateTo.value = '';
    if (toggleInPerson) toggleInPerson.checked = true;
    if (toggleOnline) toggleOnline.checked = true;
    if (toggleNearMe) toggleNearMe.checked = false;
    if (priceMinInput) priceMinInput.value = '0';
    if (priceMaxInput) priceMaxInput.value = '';
    if (priceRangeMax) priceRangeMax.value = '200';
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
    postcodeInput,
    typeSelect,
    sortSelect,
    dateFrom,
    dateTo,
    toggleInPerson,
    toggleOnline,
    toggleNearMe,
    priceMinInput,
    priceMaxInput,
    priceRangeMax,
  ].forEach(bindFilter);

  if (priceRangeMax && priceMaxInput) {
    priceRangeMax.addEventListener('input', function () {
      priceMaxInput.value = priceRangeMax.value;
      updatePriceLabel();
      applyFilters();
    });
  }

  if (priceTrigger && priceWrap) {
    priceTrigger.addEventListener('click', function () {
      pricePanelOpen = !pricePanelOpen;
      priceWrap.classList.toggle('is-open', pricePanelOpen);
    });
    document.addEventListener('click', function (e) {
      if (!priceWrap.contains(e.target)) {
        pricePanelOpen = false;
        priceWrap.classList.remove('is-open');
      }
    });
  }

  var clearBtn = document.getElementById('clear-filters');
  if (clearBtn) clearBtn.addEventListener('click', resetFilters);

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

  if (mapViewBtn) {
    mapViewBtn.addEventListener('click', function () {
      mapViewBtn.disabled = true;
      mapViewBtn.textContent = 'Map view — coming soon';
    });
  }

  if (location.hash === '#exhibitions' || location.search.indexOf('type=exhibition') !== -1) {
    if (typeSelect) typeSelect.value = 'exhibition';
  } else if (location.hash === '#meetings' || location.search.indexOf('type=meeting') !== -1) {
    if (typeSelect) typeSelect.value = 'meeting';
  }

  updatePriceLabel();
})();
