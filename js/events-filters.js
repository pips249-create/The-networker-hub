(function () {
  var searchInput = document.getElementById('search');
  var postcodeInput = document.getElementById('postcode');
  var sortSelect = document.getElementById('sort');
  var dateRangeInput = document.getElementById('date-range');
  var checkInPerson = document.getElementById('check-inperson');
  var checkOnline = document.getElementById('check-online');
  var checkHybrid = document.getElementById('check-hybrid');
  var checkFree = document.getElementById('check-free');
  var checkPaid = document.getElementById('check-paid');
  var toggleNearMe = document.getElementById('toggle-nearme');
  var resultsCount = document.getElementById('results-count');
  var spotlightPrev = document.getElementById('spotlight-prev');
  var spotlightNext = document.getElementById('spotlight-next');
  var spotlightTrack = document.getElementById('spotlight-track');
  var mapViewBtn = document.getElementById('map-view-btn');
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
    var wantHybrid = checkHybrid && checkHybrid.checked;
    var fmt = meetingTypeSlug(ev);
    if (checkInPerson || checkOnline || checkHybrid) {
      if (!wantInPerson && !wantOnline && !wantHybrid) return false;
      if (!fmt) {
        if (!wantInPerson) return false;
      } else if (fmt === 'in-person' && !wantInPerson) return false;
      else if (fmt === 'online' && !wantOnline) return false;
      else if (fmt === 'hybrid' && !wantHybrid) return false;
    }

    if (dateFromTs || dateToTs) {
      var evTs = eventDateTs(ev);
      if (evTs == null || Number.isNaN(evTs)) return false;
      if (dateFromTs && evTs < dateFromTs) return false;
      if (dateToTs && evTs > dateToTs) return false;
    }

    var wantFree = checkFree && checkFree.checked;
    var wantPaid = checkPaid && checkPaid.checked;
    if (checkFree || checkPaid) {
      if (!wantFree && !wantPaid) return false;
      var hasFree = Boolean(ev.hasFreeTickets);
      var hasPaid = Boolean(ev.hasPaidTickets);
      if (!hasFree && !hasPaid) {
        hasFree = ev.priceKey === 'free';
        hasPaid = ev.priceKey === 'paid';
      }
      if (wantFree && !wantPaid && !hasFree) return false;
      if (wantPaid && !wantFree && !hasPaid) return false;
      if (wantFree && wantPaid && !hasFree && !hasPaid) return false;
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

  window.hubGetFilteredEvents = function (all) {
    var list = (all || window.hubAllEvents || []).filter(eventMatchesFilters);
    return sortEvents(list);
  };

  function applyFilters() {
    var all = window.hubAllEvents || [];
    var filtered = window.hubGetFilteredEvents(all);

    if (resultsCount) resultsCount.textContent = String(filtered.length);

    if (window.hubRefreshListings) window.hubRefreshListings();
    if (window.hubRefreshMap) window.hubRefreshMap(filtered);
  }

  function onPostcodeInput() {
    applyFilters();
  }

  function resetFilters() {
    if (searchInput) searchInput.value = '';
    if (postcodeInput) postcodeInput.value = '';
    if (sortSelect) sortSelect.value = 'recommended';
    if (flatpickrInstance) flatpickrInstance.clear();
    dateFromTs = null;
    dateToTs = null;
    if (checkInPerson) checkInPerson.checked = true;
    if (checkOnline) checkOnline.checked = true;
    if (checkHybrid) checkHybrid.checked = true;
    if (checkFree) checkFree.checked = true;
    if (checkPaid) checkPaid.checked = true;
    if (toggleNearMe) toggleNearMe.checked = false;
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

  [searchInput, sortSelect, checkInPerson, checkOnline, checkHybrid, checkFree, checkPaid].forEach(bindFilter);

  if (postcodeInput) {
    postcodeInput.addEventListener('input', onPostcodeInput);
    postcodeInput.addEventListener('change', onPostcodeInput);
  }
  if (toggleNearMe) {
    toggleNearMe.addEventListener('change', onPostcodeInput);
  }

  typeTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      setActiveTypeTab(tab.getAttribute('data-type') || 'all');
      applyFilters();
    });
  });

  var clearBtn = document.getElementById('clear-filters');
  if (clearBtn) {
    clearBtn.addEventListener('click', resetFilters);
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
    setActiveTypeTab('exhibition');
  } else if (location.hash === '#meetings' || location.search.indexOf('type=meeting') !== -1) {
    setActiveTypeTab('meeting');
  }
})();
