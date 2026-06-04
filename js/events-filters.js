(function () {
  var typeSelect = document.getElementById('filter-type');
  var searchInput = document.getElementById('search');
  var sortSelect = document.getElementById('sort');
  var locationSelect = document.getElementById('location');
  var industrySelect = document.getElementById('industry');
  var formatSelect = document.getElementById('format');
  var priceSelect = document.getElementById('price');
  var typeTabs = document.querySelectorAll('.type-tab');
  var resultsCount = document.getElementById('results-count');
  var spotlightPrev = document.getElementById('spotlight-prev');
  var spotlightNext = document.getElementById('spotlight-next');
  var spotlightTrack = document.getElementById('spotlight-track');

  function getActiveType() {
    return typeSelect ? typeSelect.value || 'all' : 'all';
  }

  function eventMatchesFilters(ev) {
    var type = getActiveType();
    if (type !== 'all' && ev.type !== type) return false;

    var q = (searchInput && searchInput.value) || '';
    q = q.trim().toLowerCase();
    if (q && (ev.search || '').indexOf(q) === -1) return false;

    var loc = locationSelect && locationSelect.value;
    if (loc && ev.locationSlug !== loc) return false;

    var ind = industrySelect && industrySelect.value;
    if (ind && ev.industrySlug !== ind) return false;

    var fmt = formatSelect && formatSelect.value;
    if (fmt && ev.formatSlug !== fmt) return false;

    var price = priceSelect && priceSelect.value;
    if (price && ev.priceKey !== price) return false;

    return true;
  }

  function sortEvents(list) {
    var sort = (sortSelect && sortSelect.value) || 'date';
    var copy = list.slice();
    copy.sort(function (a, b) {
      if (sort === 'rating') {
        return (Number(b.rating) || 0) - (Number(a.rating) || 0);
      }
      if (sort === 'price') {
        return (Number(a.priceNum) || 0) - (Number(b.priceNum) || 0);
      }
      var da = a.dateRaw ? new Date(a.dateRaw).getTime() : 0;
      var db = b.dateRaw ? new Date(b.dateRaw).getTime() : 0;
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da - db;
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

    var meetings = all.filter(function (e) {
      return e.type === 'meeting';
    }).length;
    var exhibitions = all.filter(function (e) {
      return e.type === 'exhibition';
    }).length;
    var elAll = document.getElementById('count-all');
    var elM = document.getElementById('count-meeting');
    var elE = document.getElementById('count-exhibition');
    if (elAll) elAll.textContent = '(' + all.length + ')';
    if (elM) elM.textContent = '(' + meetings + ')';
    if (elE) elE.textContent = '(' + exhibitions + ')';

    if (window.hubRefreshListings) window.hubRefreshListings();
  }

  function setActiveType(value) {
    if (typeSelect) typeSelect.value = value;
    typeTabs.forEach(function (tab) {
      var active = tab.getAttribute('data-type') === value;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    applyFilters();
  }

  function resetFilters() {
    if (searchInput) searchInput.value = '';
    if (locationSelect) locationSelect.value = '';
    if (industrySelect) industrySelect.value = '';
    if (formatSelect) formatSelect.value = '';
    if (priceSelect) priceSelect.value = '';
    if (sortSelect) sortSelect.value = 'date';
    setActiveType('all');
  }

  window.hubApplyFilters = applyFilters;
  window.hubResetFilters = resetFilters;
  window.hubBindFilters = function () {};

  typeTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      setActiveType(tab.getAttribute('data-type'));
    });
  });

  if (typeSelect) {
    typeSelect.addEventListener('change', function () {
      setActiveType(typeSelect.value);
    });
  }

  [searchInput, sortSelect, locationSelect, industrySelect, formatSelect, priceSelect].forEach(function (el) {
    if (!el) return;
    el.addEventListener('input', applyFilters);
    el.addEventListener('change', applyFilters);
  });

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

  if (location.hash === '#exhibitions' || location.search.indexOf('type=exhibition') !== -1) {
    setActiveType('exhibition');
  } else if (location.hash === '#meetings' || location.search.indexOf('type=meeting') !== -1) {
    setActiveType('meeting');
  }
})();
