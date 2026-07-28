(function () {
  var searchInput = document.getElementById('search');
  var sortSelect = document.getElementById('sort');
  var hasListings = document.getElementById('org-has-listings');
  var guestVisits = document.getElementById('org-guest-visits');
  var resultsCount = document.getElementById('results-count');
  var typeTabs = document.querySelectorAll('.org-type-tab[data-org-tab]');

  var activeTab = 'all';
  var browseRandomOrder = null;

  function getActiveTab() {
    return activeTab || 'all';
  }

  function shuffleList(list) {
    var copy = list.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function hasActiveOrganiserFilters() {
    var q = (searchInput && searchInput.value) || '';
    if (q.trim()) return true;
    if (sortSelect && sortSelect.value && sortSelect.value !== 'recommended') return true;
    if (getActiveTab() !== 'all') return true;
    if (hasListings && hasListings.checked) return true;
    if (guestVisits && guestVisits.checked) return true;
    return false;
  }

  function applyBrowseRandomOrder(list) {
    if (!browseRandomOrder) {
      browseRandomOrder = shuffleList(list).map(function (org) {
        return org.id;
      });
    }
    var byId = {};
    list.forEach(function (org) {
      byId[org.id] = org;
    });
    var ordered = [];
    browseRandomOrder.forEach(function (id) {
      if (byId[id]) {
        ordered.push(byId[id]);
        delete byId[id];
      }
    });
    Object.keys(byId).forEach(function (id) {
      ordered.push(byId[id]);
    });
    return ordered;
  }

  function organiserMatchesFilters(org) {
    var tab = getActiveTab();
    if (tab === 'featured' && !org.featured) return false;

    var q = (searchInput && searchInput.value) || '';
    q = q.trim().toLowerCase();
    if (q) {
      var hay = org.search || '';
      var terms = q.split(/\s+/).filter(Boolean);
      for (var i = 0; i < terms.length; i++) {
        if (hay.indexOf(terms[i]) === -1) return false;
      }
    }

    var regional = window.hubRegionalLanding;
    if (regional && regional.location) {
      var locations = Array.isArray(org.locations) ? org.locations : [];
      var matchesRegion = locations.some(function (location) {
        return window.hubMatchOutcode
          ? window.hubMatchOutcode(regional.location, location || {})
          : false;
      });
      if (!matchesRegion) return false;
    }

    if (hasListings && hasListings.checked && !(Number(org.eventCount) > 0)) return false;
    if (guestVisits && guestVisits.checked && !(Number(org.guestVisitsAllowed) > 0)) return false;

    return true;
  }

  function sortOrganisers(list, options) {
    options = options || {};
    if (!options.tabOverride && !hasActiveOrganiserFilters()) {
      return applyBrowseRandomOrder(list);
    }
    if (!options.tabOverride && hasActiveOrganiserFilters()) {
      browseRandomOrder = null;
    }

    var sort = (sortSelect && sortSelect.value) || 'recommended';
    var copy = list.slice();
    copy.sort(function (a, b) {
      if (sort === 'best-rated' || sort === 'rating' || sort === 'rating-desc') {
        return (Number(b.rating) || 0) - (Number(a.rating) || 0);
      }
      if (sort === 'rating-asc') {
        return (Number(a.rating) || 0) - (Number(b.rating) || 0);
      }
      if (sort === 'listings') {
        return (Number(b.eventCount) || 0) - (Number(a.eventCount) || 0);
      }
      if (sort === 'name') {
        return String(a.name).localeCompare(String(b.name));
      }
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      var rb = Number(b.rating) || 0;
      var ra = Number(a.rating) || 0;
      if (rb !== ra) return rb - ra;
      return String(a.name).localeCompare(String(b.name));
    });
    return copy;
  }

  window.hubGetFilteredOrganisers = function (all, options) {
    options = options || {};
    var savedTab = activeTab;
    if (options.tab != null) activeTab = options.tab;
    var list = (all || window.hubAllOrganisers || []).filter(organiserMatchesFilters);
    if (options.tab != null) activeTab = savedTab;
    return sortOrganisers(list, { tabOverride: options.tab != null });
  };

  function applyFilters() {
    if (!document.body.classList.contains('browse-mode-organisers')) return;
    var all = window.hubAllOrganisers || [];
    var filtered = window.hubGetFilteredOrganisers(all);
    if (resultsCount) resultsCount.textContent = String(filtered.length);
    if (window.hubRefreshOrganiserListings) window.hubRefreshOrganiserListings();
    logOrganiserBrowseSearch(filtered.length);
  }

  function logOrganiserBrowseSearch(resultCount) {
    if (!window.HubBrowseAnalytics || typeof window.HubBrowseAnalytics.logSearch !== 'function') return;
    if (!hasActiveOrganiserFilters() && !(window.hubRegionalLanding && window.hubRegionalLanding.location)) {
      return;
    }
    var regional = window.hubRegionalLanding || null;
    window.HubBrowseAnalytics.logSearch({
      source: 'organisers_browse',
      q: (searchInput && searchInput.value) || '',
      location: (regional && (regional.location || regional.name)) || '',
      regionSlug: (regional && regional.slug) || '',
      tab: getActiveTab(),
      hasListings: !!(hasListings && hasListings.checked),
      guestVisits: !!(guestVisits && guestVisits.checked),
      sort: (sortSelect && sortSelect.value) || '',
      resultCount: Number(resultCount) || 0,
    });
  }

  function resetFilters() {
    if (searchInput) searchInput.value = '';
    if (sortSelect) sortSelect.value = 'recommended';
    if (hasListings) hasListings.checked = false;
    if (guestVisits) guestVisits.checked = false;
    browseRandomOrder = null;
    setActiveTab('all');
    applyFilters();
  }

  function setActiveTab(tab) {
    activeTab = tab || 'all';
    typeTabs.forEach(function (btn) {
      var active = btn.getAttribute('data-org-tab') === activeTab;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  window.hubApplyOrganiserFilters = applyFilters;
  window.hubResetOrganiserFilters = resetFilters;
  window.hubResetOrganiserBrowseOrder = function () {
    browseRandomOrder = null;
  };

  function bindFilter(el) {
    if (!el) return;
    el.addEventListener('input', applyFilters);
    el.addEventListener('change', applyFilters);
  }

  [searchInput, sortSelect, hasListings, guestVisits].forEach(bindFilter);

  typeTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      setActiveTab(tab.getAttribute('data-org-tab') || 'all');
      applyFilters();
    });
  });

  var clearBtn = document.getElementById('clear-filters');
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      if (document.body.classList.contains('browse-mode-organisers')) resetFilters();
    });
  }
})();
