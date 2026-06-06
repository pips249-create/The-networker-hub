(function () {
  var searchInput = document.getElementById('search');
  var sortSelect = document.getElementById('sort');
  var industrySelect = document.getElementById('org-industry');
  var rating4 = document.getElementById('org-rating-4');
  var rating3 = document.getElementById('org-rating-3');
  var rating2 = document.getElementById('org-rating-2');
  var rating1 = document.getElementById('org-rating-1');
  var ratingNone = document.getElementById('org-rating-none');
  var resultsCount = document.getElementById('results-count');
  var typeTabs = document.querySelectorAll('.org-type-tab[data-org-tab]');

  var activeTab = 'all';

  function getActiveTab() {
    return activeTab || 'all';
  }

  function slugIndustryLabel(label) {
    return String(label || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function organiserRating(org) {
    return Number(org.rating) || 0;
  }

  function organiserHasNoRatings(org) {
    var rating = organiserRating(org);
    var reviews = Number(org.reviews) || 0;
    return rating <= 0 || reviews <= 0;
  }

  function matchesRatingFilter(org) {
    var want4 = rating4 && rating4.checked;
    var want3 = rating3 && rating3.checked;
    var want2 = rating2 && rating2.checked;
    var want1 = rating1 && rating1.checked;
    var wantNone = ratingNone && ratingNone.checked;

    if (!want4 && !want3 && !want2 && !want1 && !wantNone) return false;

    var rating = organiserRating(org);
    if (wantNone && organiserHasNoRatings(org)) return true;
    if (want4 && rating >= 4) return true;
    if (want3 && rating >= 3) return true;
    if (want2 && rating >= 2) return true;
    if (want1 && rating >= 1) return true;
    return false;
  }

  var DEFAULT_INDUSTRIES = [
    'Technology & Digital',
    'Professional Services',
    'Finance & Insurance',
    'Health & Wellbeing',
    'Property & Construction',
    'Retail & Hospitality',
    'Marketing & Creative',
    'General Networking',
  ];

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

    var industry = (industrySelect && industrySelect.value) || '';
    if (industry) {
      var slugs = (org.industries || []).map(slugIndustryLabel);
      if (slugs.indexOf(industry) !== -1 || org.industrySlug === industry) {
        /* matched explicit industry */
      } else {
        var label =
          industrySelect.options[industrySelect.selectedIndex] &&
          industrySelect.options[industrySelect.selectedIndex].text;
        var hayIndustry = org.search || String(org.name || '').toLowerCase();
        var labelLower = String(label || '').toLowerCase();
        if (!labelLower || hayIndustry.indexOf(labelLower) === -1) return false;
      }
    }

    if (!matchesRatingFilter(org)) return false;

    return true;
  }

  function sortOrganisers(list) {
    var sort = (sortSelect && sortSelect.value) || 'recommended';
    var copy = list.slice();
    copy.sort(function (a, b) {
      if (sort === 'rating') {
        return (Number(b.rating) || 0) - (Number(a.rating) || 0);
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
    return sortOrganisers(list);
  };

  function fillIndustryOptions() {
    if (!industrySelect) return;
    var selected = industrySelect.value;
    while (industrySelect.options.length > 1) industrySelect.remove(1);
    var labels = DEFAULT_INDUSTRIES.slice();
    var all = window.hubAllOrganisers || [];
    all.forEach(function (org) {
      (org.industries || []).forEach(function (ind) {
        if (ind && labels.indexOf(ind) === -1) labels.push(ind);
      });
      if (org.industry && labels.indexOf(org.industry) === -1) labels.push(org.industry);
    });
    labels.sort(function (a, b) {
      if (a === 'General Networking') return 1;
      if (b === 'General Networking') return -1;
      return String(a).localeCompare(String(b));
    });
    labels.forEach(function (label) {
      var opt = document.createElement('option');
      opt.value = slugIndustryLabel(label);
      opt.textContent = label;
      industrySelect.appendChild(opt);
    });
    if (selected) industrySelect.value = selected;
  }

  function applyFilters() {
    if (!document.body.classList.contains('browse-mode-organisers')) return;
    var all = window.hubAllOrganisers || [];
    var filtered = window.hubGetFilteredOrganisers(all);
    if (resultsCount) resultsCount.textContent = String(filtered.length);
    if (window.hubRefreshOrganiserListings) window.hubRefreshOrganiserListings();
  }

  function resetFilters() {
    if (searchInput) searchInput.value = '';
    if (industrySelect) industrySelect.value = '';
    if (sortSelect) sortSelect.value = 'recommended';
    [rating4, rating3, rating2, rating1, ratingNone].forEach(function (el) {
      if (el) el.checked = true;
    });
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

  window.hubApplyOrganiserFilters = function () {
    if (industrySelect && industrySelect.options.length <= 1) fillIndustryOptions();
    applyFilters();
  };
  window.hubResetOrganiserFilters = resetFilters;

  function bindFilter(el) {
    if (!el) return;
    el.addEventListener('input', applyFilters);
    el.addEventListener('change', applyFilters);
  }

  [searchInput, sortSelect, industrySelect, rating4, rating3, rating2, rating1, ratingNone].forEach(
    bindFilter
  );

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
