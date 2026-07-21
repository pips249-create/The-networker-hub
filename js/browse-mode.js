/**
 * Switch between Events and Organisers browse on /events/.
 */
(function () {
  var heroBadge = document.getElementById('events-hero-badge');
  var heroTitle = document.getElementById('events-hero-heading');
  var heroBrowseLink = document.getElementById('events-hero-browse-link');
  var heroSub = document.getElementById('events-hero-lede');
  var listingsHeader = document.getElementById('all-heading');
  var searchInput = document.getElementById('search');
  var searchLabel = document.querySelector('label[for="search"]');
  var sortSelect = document.getElementById('sort');
  var filterBar = document.querySelector('.events-filter-bar');

  var copy = {
    events: {
      badge: 'Event discovery',
      title: 'Find your next <span class="accent">business event</span>',
      sub: 'Meetings, exhibitions, workshops &amp; more.<br>Filter by online/in person, date, location and price.',
      heading: 'All listings',
      searchPlaceholder: 'Search anything — breakfast, women only, organiser, city…',
      searchLabel: 'Search events',
      filterLabel: 'Filter events',
    },
    organisers: {
      badge: 'Organiser directory',
      title:
        'Find your next <span class="accent">event host</span>',
      sub: 'Browse groups, exhibition hosts, and conference organisers, then see their events.',
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

  function browseModeHref(mode) {
    try {
      var url = new URL(location.href);
      if (mode === 'organisers') url.searchParams.set('mode', 'organisers');
      else url.searchParams.delete('mode');
      url.hash = '';
      return url.pathname + url.search;
    } catch (e) {
      return mode === 'organisers' ? '/events/?mode=organisers' : '/events/';
    }
  }

  function syncBrowseToggles(mode) {
    document.querySelectorAll('[data-browse-mode]').forEach(function (el) {
      var elMode = el.getAttribute('data-browse-mode');
      var isActive = elMode === mode;
      el.classList.toggle('is-active', isActive);
      if (el.tagName === 'A') {
        if (elMode) el.setAttribute('href', browseModeHref(elMode));
        if (isActive) el.setAttribute('aria-current', 'page');
        else el.removeAttribute('aria-current');
      } else {
        el.setAttribute('aria-selected', isActive ? 'true' : 'false');
      }
    });
  }

  function syncHeroBrowseLink(mode) {
    if (!heroBrowseLink) return;
    if (mode === 'organisers') {
      heroBrowseLink.innerHTML =
        'Looking for an event? <a href="' +
        browseModeHref('events') +
        '">Browse events</a>';
    } else {
      heroBrowseLink.innerHTML =
        'Looking for a networking group? <a href="' +
        browseModeHref('organisers') +
        '">Browse organisers</a>';
    }
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
      syncHeroBrowseLink(mode);
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
    syncHeroBrowseLink(mode);
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

    if (options.updateHash !== false) {
      try {
        var url = new URL(location.href);
        if (isOrganisers) url.searchParams.set('mode', 'organisers');
        else url.searchParams.delete('mode');
        url.hash = '';
        var next = url.pathname + url.search;
        var current = location.pathname + location.search;
        if (current !== next) history.replaceState(null, '', next);
      } catch (e) {
        /* ignore */
      }
    }
  }

  window.hubSetBrowseMode = setMode;

  var initial = 'events';
  if (location.hash === '#organisers' || location.search.indexOf('mode=organisers') !== -1) {
    initial = 'organisers';
  }

  if (initial === 'organisers') {
    setMode('organisers', { skipEventsRefresh: true, updateHash: true });
  } else {
    // Clear a leftover #events so the address bar stays /events/
    setMode('events', {
      skipEventsRefresh: true,
      updateHash: location.hash === '#events',
    });
  }

  window.addEventListener('hashchange', function () {
    if (location.hash !== '#organisers') return;
    try {
      var url = new URL(location.href);
      url.searchParams.set('mode', 'organisers');
      url.hash = '';
      history.replaceState(null, '', url.pathname + url.search);
    } catch (e) {
      /* ignore */
    }
    if (currentMode() !== 'organisers') setMode('organisers', { updateHash: false });
  });
})();
