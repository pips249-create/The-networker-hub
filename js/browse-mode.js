/**
 * Switch between Events and Organisers browse on /events/.
 */
(function () {
  var MODE_KEY = 'hubBrowseMode';
  var heroBadge = document.getElementById('events-hero-badge');
  var heroTitle = document.getElementById('events-hero-heading');
  var heroSub = document.getElementById('events-hero-lede');
  var listingsHeader = document.getElementById('all-heading');
  var searchInput = document.getElementById('search');
  var searchLabel = document.querySelector('label[for="search"]');
  var sortSelect = document.getElementById('sort');
  var filterBar = document.querySelector('.events-filter-bar');

  var copy = {
    events: {
      badge: 'Event discovery',
      title: 'Find your next <span class="accent">business event</span> across the UK',
      sub: 'Meetings, exhibitions, workshops, and more — filter by type, date, and location.',
      heading: 'All listings',
      searchPlaceholder: 'Search anything — breakfast, women only, organiser, city…',
      searchLabel: 'Search events',
      filterLabel: 'Filter events',
    },
    organisers: {
      badge: 'Organiser directory',
      title:
        'Find <span class="accent">networking groups &amp; organisers</span> across the UK',
      sub: 'Browse groups, exhibition hosts, and conference organisers — then see their events.',
      heading: 'All organisers',
      searchPlaceholder: 'Search organisers, descriptions, formats…',
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
    var priceAsc = sortSelect.querySelector('option[value="price-asc"]');
    var priceDesc = sortSelect.querySelector('option[value="price-desc"]');
    var listings = sortSelect.querySelector('option[value="listings"]');
    var name = sortSelect.querySelector('option[value="name"]');

    if (date) date.hidden = mode === 'organisers';
    if (priceAsc) priceAsc.hidden = mode === 'organisers';
    if (priceDesc) priceDesc.hidden = mode === 'organisers';
    if (listings) listings.hidden = mode === 'events';
    if (name) name.hidden = mode === 'events';

    if (mode === 'organisers') {
      if (
        sortSelect.value === 'date' ||
        sortSelect.value === 'price' ||
        sortSelect.value === 'price-asc' ||
        sortSelect.value === 'price-desc'
      ) {
        sortSelect.value = 'recommended';
      }
    } else if (sortSelect.value === 'listings' || sortSelect.value === 'name') {
      sortSelect.value = 'recommended';
    }

    if (recommended) recommended.textContent = mode === 'organisers' ? 'Recommended' : 'Recommended';
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

  function sponsorSlotForMode(mode) {
    return mode === 'organisers' ? 'organisers_sponsor_hub' : 'events_sponsor_hub';
  }

  function initSponsorHub(mode) {
    var hub = document.getElementById('sponsor-hub');
    var heroSlot = document.getElementById('hero-sponsor-slot');
    if (!hub || !heroSlot) return;
    if (hub.parentElement !== heroSlot) heroSlot.appendChild(hub);
    heroSlot.hidden = false;
    hub.classList.add('sponsor-hub--in-hero');
    hub.setAttribute('data-slot', sponsorSlotForMode(mode || currentMode()));
  }

  function reloadSponsorHub(mode) {
    initSponsorHub(mode);
    if (window.hubReloadSponsorBlock) window.hubReloadSponsorBlock();
  }

  function syncBrowseToggles(mode) {
    document.querySelectorAll('[data-browse-mode]').forEach(function (btn) {
      var isActive = btn.getAttribute('data-browse-mode') === mode;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  function applyCopy(mode) {
    var c = copy[mode] || copy.events;
    var regional = window.hubRegionalLanding;
    if (regional && regional.name) {
      var year = new Date().getFullYear();
      if (heroBadge) heroBadge.textContent = 'Local networking directory';
      if (heroTitle) {
        heroTitle.innerHTML =
          'The best business networking events &amp; groups in <span class="accent"></span>';
        var accent = heroTitle.querySelector('.accent');
        if (accent) accent.textContent = regional.name + ' ' + year;
      }
      if (heroSub) {
        heroSub.textContent =
          mode === 'organisers'
            ? 'Discover the organiser communities running business networking across ' +
              regional.name +
              '.'
            : 'Discover upcoming meetings, workshops, conferences and local networking communities across ' +
              regional.name +
              '.';
      }
      if (listingsHeader) {
        listingsHeader.textContent =
          mode === 'organisers'
            ? 'Networking groups in ' + regional.name
            : 'Upcoming networking events in ' + regional.name;
      }
      if (searchInput) searchInput.placeholder = c.searchPlaceholder;
      if (searchLabel) searchLabel.textContent = c.searchLabel;
      if (filterBar) filterBar.setAttribute('aria-label', c.filterLabel);
      document.title =
        'Business Networking Events in ' +
        regional.name +
        ' ' +
        year +
        ' – The Networker Hub';
      initSponsorHub(mode);
      syncBrowseToggles(mode);
      return;
    }
    if (heroBadge) heroBadge.textContent = c.badge;
    if (heroTitle) heroTitle.innerHTML = c.title;
    if (heroSub) heroSub.innerHTML = c.sub;
    if (listingsHeader) listingsHeader.textContent = c.heading;
    if (searchInput) searchInput.placeholder = c.searchPlaceholder;
    if (searchLabel) searchLabel.textContent = c.searchLabel;
    if (filterBar) filterBar.setAttribute('aria-label', c.filterLabel);
    document.title =
      mode === 'organisers'
        ? 'Find networking groups – The Networker Hub'
        : 'Find your next event – The Networker Hub';
    initSponsorHub(mode);
    syncBrowseToggles(mode);
  }

  function setMode(mode, options) {
    options = options || {};
    var isOrganisers = mode === 'organisers';
    document.body.classList.toggle('browse-mode-organisers', isOrganisers);

    ensureOrganiserSortOptions();
    updateSortOptions(mode);
    applyCopy(mode);
    reloadSponsorHub(mode);

    if (isOrganisers) {
      if (window.hubToggleMapView && document.body.classList.contains('events-view-map')) {
        window.hubToggleMapView();
      }
      if (window.hubLoadOrganisers) {
        window.hubLoadOrganisers().then(function () {
          if (window.hubApplyOrganiserFilters) window.hubApplyOrganiserFilters();
          else if (window.hubRenderOrganiserSpotlight) window.hubRenderOrganiserSpotlight();
        });
      } else if (window.hubRenderOrganiserSpotlight) {
        window.hubRenderOrganiserSpotlight();
      }
    } else {
      if (window.hubStopOrganiserSpotlight) window.hubStopOrganiserSpotlight();
      if (!options.skipEventsRefresh) {
        if (window.hubApplyFilters) window.hubApplyFilters();
        else if (window.hubRefreshListings) window.hubRefreshListings();
      }
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

  document.querySelectorAll('[data-browse-mode]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var target = btn.getAttribute('data-browse-mode');
      if (!target || target === currentMode()) return;
      setMode(target);
    });
  });

  window.hubSetBrowseMode = setMode;

  var initial = 'events';
  if (location.hash === '#organisers' || location.search.indexOf('mode=organisers') !== -1) {
    initial = 'organisers';
  } else if (location.hash === '#events') {
    initial = 'events';
  }

  if (initial === 'organisers') {
    setMode('organisers', { skipEventsRefresh: true, updateHash: true });
  } else {
    setMode('events', { skipEventsRefresh: true, updateHash: true });
  }

  window.addEventListener('hashchange', function () {
    var want = location.hash === '#organisers' ? 'organisers' : 'events';
    if (want !== currentMode()) setMode(want, { updateHash: false });
  });
})();
