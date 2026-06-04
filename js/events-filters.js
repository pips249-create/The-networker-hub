(function () {
  var typeSelect = document.getElementById('filter-type');
  var searchInput = document.getElementById('search');
  var locationSelect = document.getElementById('location');
  var industrySelect = document.getElementById('industry');
  var formatSelect = document.getElementById('format');
  var priceSelect = document.getElementById('price');
  var typeTabs = document.querySelectorAll('.type-tab');
  var resultsCount = document.getElementById('results-count');
  var spotlightPrev = document.getElementById('spotlight-prev');
  var spotlightNext = document.getElementById('spotlight-next');
  var spotlightTrack = document.getElementById('spotlight-track');

  function getItems() {
    return document.querySelectorAll(
      '.premium-card, .event-row, .event-card'
    );
  }

  function getActiveType() {
    return typeSelect ? typeSelect.value || 'all' : 'all';
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

  function itemMatches(el) {
    var type = getActiveType();
    if (type !== 'all' && el.getAttribute('data-type') !== type) return false;

    var q = (searchInput && searchInput.value || '').trim().toLowerCase();
    if (q && (el.getAttribute('data-search') || '').indexOf(q) === -1) return false;

    var loc = locationSelect && locationSelect.value;
    if (loc && el.getAttribute('data-location') !== loc) return false;

    var ind = industrySelect && industrySelect.value;
    if (ind && el.getAttribute('data-industry') !== ind) return false;

    var fmt = formatSelect && formatSelect.value;
    if (fmt && el.getAttribute('data-format') !== fmt) return false;

    var price = priceSelect && priceSelect.value;
    if (price && el.getAttribute('data-price') !== price) return false;

    return true;
  }

  function applyFilters() {
    var items = getItems();
    var visibleListings = 0;
    items.forEach(function (el) {
      var show = itemMatches(el);
      el.classList.toggle('is-hidden', !show);
      if (show && el.classList.contains('event-row')) visibleListings++;
    });

    if (resultsCount) resultsCount.textContent = String(visibleListings);

    var empty = document.querySelector('#event-listings .empty-state');
    if (empty) empty.classList.toggle('is-visible', visibleListings === 0 && items.length > 0);

    var all = window.hubAllEvents || [];
    if (all.length) {
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
    }
  }

  function resetFilters() {
    if (searchInput) searchInput.value = '';
    if (locationSelect) locationSelect.value = '';
    if (industrySelect) industrySelect.value = '';
    if (formatSelect) formatSelect.value = '';
    if (priceSelect) priceSelect.value = '';
    setActiveType('all');
  }

  window.hubApplyFilters = applyFilters;
  window.hubResetFilters = resetFilters;
  window.hubBindFilters = function () {
    applyFilters();
  };

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

  [searchInput, locationSelect, industrySelect, formatSelect, priceSelect].forEach(function (el) {
    if (!el) return;
    el.addEventListener('input', applyFilters);
    el.addEventListener('change', applyFilters);
  });

  var clearBtn = document.getElementById('clear-filters');
  if (clearBtn) clearBtn.addEventListener('click', resetFilters);

  document.addEventListener('click', function (e) {
    if (e.target.id === 'empty-reset') resetFilters();
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
