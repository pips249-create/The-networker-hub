/**
 * Switch between Events and Organisers browse on /events/.
 */
(function () {
  var MODE_KEY = 'hubBrowseMode';
  var heroBadge = document.getElementById('events-hero-badge');
  var heroTitle = document.getElementById('events-hero-heading');
  var heroSub = document.getElementById('events-hero-lede');
  var heroSwitch = document.getElementById('hero-browse-mode-switch');
  var listingsHeader = document.getElementById('all-heading');
  var searchInput = document.getElementById('search');
  var searchLabel = document.querySelector('label[for="search"]');
  var sortSelect = document.getElementById('sort');
  var filterBar = document.querySelector('.events-filter-bar');

  var copy = {
    events: {
      badge: 'Event discovery',
      title:
        'Find <span class="accent">meetings, events, exhibitions &amp; awards</span> across the UK',
      sub:
        '<strong>The Networker Hub</strong> lists meetings, events, exhibitions and awards — filter by type, date, and location, or search for anything from breakfast networking to women only.',
      heading: 'All listings',
      searchPlaceholder: 'Search anything — breakfast, women only, organiser, city…',
      searchLabel: 'Search events',
      filterLabel: 'Filter events',
      switchLabel: 'Browse organisers',
      switchTo: 'organisers',
    },
    organisers: {
      badge: 'Organiser directory',
      title:
        'Discover <span class="accent">networking groups &amp; event organisers</span> across the UK',
      sub:
        '<strong>The Networker Hub</strong> connects you with networking groups, exhibition hosts, conference organisers and more — find the right community for your business.',
      heading: 'All organisers',
      searchPlaceholder: 'Search organisers, industries, descriptions…',
      searchLabel: 'Search organisers',
      filterLabel: 'Filter organisers',
      switchLabel: 'Browse events',
      switchTo: 'events',
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

  function initSponsorHub() {
    var hub = document.getElementById('sponsor-hub');
    var heroSlot = document.getElementById('hero-sponsor-slot');
    if (!hub || !heroSlot) return;
    if (hub.parentElement !== heroSlot) heroSlot.appendChild(hub);
    heroSlot.hidden = false;
    hub.classList.add('sponsor-hub--in-hero');
  }

  function applyCopy(mode) {
    var c = copy[mode] || copy.events;
    if (heroBadge) heroBadge.textContent = c.badge;
    if (heroTitle) heroTitle.innerHTML = c.title;
    if (heroSub) heroSub.innerHTML = c.sub;
    if (listingsHeader) listingsHeader.textContent = c.heading;
    if (searchInput) searchInput.placeholder = c.searchPlaceholder;
    if (searchLabel) searchLabel.textContent = c.searchLabel;
    if (filterBar) filterBar.setAttribute('aria-label', c.filterLabel);
    if (heroSwitch) {
      heroSwitch.textContent = c.switchLabel;
      heroSwitch.setAttribute('data-switch-to', c.switchTo);
    }
    document.title =
      mode === 'organisers'
        ? 'Find networking groups – The Networker Hub'
        : 'Find your next event – The Networker Hub';
    initSponsorHub();
  }

  function setMode(mode, options) {
    options = options || {};
    var isOrganisers = mode === 'organisers';
    document.body.classList.toggle('browse-mode-organisers', isOrganisers);

    ensureOrganiserSortOptions();
    updateSortOptions(mode);
    applyCopy(mode);

    if (isOrganisers) {
      if (window.hubToggleMapView && document.body.classList.contains('events-view-map')) {
        window.hubToggleMapView();
      }
      if (window.hubReloadSponsorBlock) window.hubReloadSponsorBlock();
      if (window.hubLoadOrganisers) {
        window.hubLoadOrganisers().then(function () {
          if (window.hubApplyOrganiserFilters) window.hubApplyOrganiserFilters();
        });
      }
    } else if (!options.skipEventsRefresh) {
      if (window.hubApplyFilters) window.hubApplyFilters();
      else if (window.hubRefreshListings) window.hubRefreshListings();
      if (window.hubReloadSponsorBlock) window.hubReloadSponsorBlock();
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

  if (heroSwitch) {
    heroSwitch.addEventListener('click', function (e) {
      e.preventDefault();
      var target = heroSwitch.getAttribute('data-switch-to') || 'organisers';
      if (target === currentMode()) return;
      setMode(target);
    });
  }

  window.hubSetBrowseMode = setMode;

  var initial = 'events';
  if (location.hash === '#organisers' || location.search.indexOf('mode=organisers') !== -1) {
    initial = 'organisers';
  } else if (location.hash === '#events') {
    initial = 'events';
  }
  /* No hash → always start on Events (nav "Browse events" links). Use #organisers to share organiser view. */

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
