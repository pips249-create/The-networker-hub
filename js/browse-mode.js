/**
 * Switch between Events and Organisers browse on /events/.
 */
(function () {
  var MODE_KEY = 'hubBrowseMode';
  var heroTitle = document.querySelector('.events-hero h1');
  var heroSub = document.querySelector('.events-hero .hero-types');
  var listingsHeader = document.getElementById('all-heading');
  var searchInput = document.getElementById('search');
  var searchLabel = document.querySelector('label[for="search"]');
  var sortSelect = document.getElementById('sort');
  var filterBar = document.querySelector('.events-filter-bar');
  var modeBtns = document.querySelectorAll('.browse-mode-btn[data-browse-mode]');

  var copy = {
    events: {
      title: 'Find your next <span class="accent">event</span>',
      sub: 'Find networking events, exhibitions and conferences across the UK',
      heading: 'All listings',
      searchPlaceholder: 'Search all meetings, people, resources…',
      searchLabel: 'Search events',
      filterLabel: 'Filter events',
    },
    organisers: {
      title: 'Find networking <span class="accent">groups</span>',
      sub: 'Discover organisers running meetings, mixers and events near you',
      heading: 'All organisers',
      searchPlaceholder: 'Search organisers, industries, descriptions…',
      searchLabel: 'Search organisers',
      filterLabel: 'Filter organisers',
    },
  };

  function currentMode() {
    return document.body.classList.contains('browse-mode-organisers') ? 'organisers' : 'events';
  }

  function updateSortOptions(mode) {
    if (!sortSelect) return;
    var recommended = sortSelect.querySelector('option[value="recommended"]');
    var date = sortSelect.querySelector('option[value="date"]');
    var rating = sortSelect.querySelector('option[value="rating"]');
    var price = sortSelect.querySelector('option[value="price"]');
    var listings = sortSelect.querySelector('option[value="listings"]');
    var name = sortSelect.querySelector('option[value="name"]');

    if (date) date.hidden = mode === 'organisers';
    if (price) price.hidden = mode === 'organisers';
    if (listings) listings.hidden = mode === 'events';
    if (name) name.hidden = mode === 'events';

    if (mode === 'organisers') {
      if (sortSelect.value === 'date' || sortSelect.value === 'price') sortSelect.value = 'recommended';
    } else if (sortSelect.value === 'listings' || sortSelect.value === 'name') {
      sortSelect.value = 'recommended';
    }

    if (recommended) recommended.textContent = mode === 'organisers' ? 'Recommended' : 'Recommended';
    if (listings && !listings.parentNode) {
      /* option added in HTML */
    }
  }

  function ensureOrganiserSortOptions() {
    if (!sortSelect) return;
    if (!sortSelect.querySelector('option[value="listings"]')) {
      var listingsOpt = document.createElement('option');
      listingsOpt.value = 'listings';
      listingsOpt.textContent = 'Most listings';
      listingsOpt.hidden = true;
      sortSelect.appendChild(listingsOpt);
    }
    if (!sortSelect.querySelector('option[value="name"]')) {
      var nameOpt = document.createElement('option');
      nameOpt.value = 'name';
      nameOpt.textContent = 'Name A–Z';
      nameOpt.hidden = true;
      sortSelect.appendChild(nameOpt);
    }
  }

  function applyCopy(mode) {
    var c = copy[mode] || copy.events;
    if (heroTitle) heroTitle.innerHTML = c.title;
    if (heroSub) heroSub.textContent = c.sub;
    if (listingsHeader) listingsHeader.textContent = c.heading;
    if (searchInput) searchInput.placeholder = c.searchPlaceholder;
    if (searchLabel) searchLabel.textContent = c.searchLabel;
    if (filterBar) filterBar.setAttribute('aria-label', c.filterLabel);
    document.title =
      mode === 'organisers'
        ? 'Find networking groups – The Networker Hub'
        : 'Find your next event – The Networker Hub';
  }

  function setMode(mode, options) {
    options = options || {};
    var isOrganisers = mode === 'organisers';
    document.body.classList.toggle('browse-mode-organisers', isOrganisers);
    modeBtns.forEach(function (btn) {
      var active = btn.getAttribute('data-browse-mode') === mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    ensureOrganiserSortOptions();
    updateSortOptions(mode);
    applyCopy(mode);

    if (isOrganisers) {
      if (window.hubToggleMapView && document.body.classList.contains('events-view-map')) {
        window.hubToggleMapView();
      }
      if (window.hubLoadOrganisers) {
        window.hubLoadOrganisers().then(function () {
          if (window.hubApplyOrganiserFilters) window.hubApplyOrganiserFilters();
        });
      }
    } else if (!options.skipEventsRefresh && window.hubApplyFilters) {
      window.hubApplyFilters();
    }

    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch (e) {
      /* ignore */
    }

    if (options.updateHash !== false) {
      var hash = isOrganisers ? '#organisers' : '#events';
      if (location.hash !== hash) history.replaceState(null, '', hash);
    }
  }

  modeBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var mode = btn.getAttribute('data-browse-mode') || 'events';
      if (mode === currentMode()) return;
      setMode(mode);
    });
  });

  window.hubSetBrowseMode = setMode;

  var initial = 'events';
  if (location.hash === '#organisers' || location.search.indexOf('mode=organisers') !== -1) {
    initial = 'organisers';
  } else {
    try {
      var stored = localStorage.getItem(MODE_KEY);
      if (stored === 'organisers' || stored === 'events') initial = stored;
    } catch (e) {
      /* ignore */
    }
  }

  if (initial === 'organisers') {
    setMode('organisers', { skipEventsRefresh: true, updateHash: true });
  }

  window.addEventListener('hashchange', function () {
    var want = location.hash === '#organisers' ? 'organisers' : 'events';
    if (want !== currentMode()) setMode(want, { updateHash: false });
  });
})();
