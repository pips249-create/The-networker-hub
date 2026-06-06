(function () {
  var searchInput = document.getElementById('search');
  var sortSelect = document.getElementById('sort');
  var industrySelect = document.getElementById('org-industry');
  var checkInPerson = document.getElementById('org-check-inperson');
  var checkOnline = document.getElementById('org-check-online');
  var checkHybrid = document.getElementById('org-check-hybrid');
  var resultsCount = document.getElementById('results-count');
  var typeTabs = document.querySelectorAll('.org-type-tab[data-org-tab]');

  var activeTab = 'all';

  function getActiveTab() {
    return activeTab || 'all';
  }

  function formatSlug(fmt) {
    var raw = String(fmt || '').trim().toLowerCase();
    if (!raw) return '';
    if (raw.indexOf('hybrid') !== -1) return 'hybrid';
    if (raw.indexOf('online') !== -1 && raw.indexOf('person') === -1) return 'online';
    if (raw.indexOf('person') !== -1 || raw.indexOf('in person') !== -1) return 'in-person';
    return raw.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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

    var industry = (industrySelect && industrySelect.value) || '';
    if (industry) {
      var slugs = (org.industries || []).map(function (ind) {
        return String(ind || '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
      });
      if (slugs.indexOf(industry) === -1 && org.industrySlug !== industry) return false;
    }

    var wantInPerson = checkInPerson && checkInPerson.checked;
    var wantOnline = checkOnline && checkOnline.checked;
    var wantHybrid = checkHybrid && checkHybrid.checked;
    if (checkInPerson || checkOnline || checkHybrid) {
      if (!wantInPerson && !wantOnline && !wantHybrid) return false;
      var formats = org.formatSlugs || (org.meetingFormats || []).map(formatSlug);
      if (!formats.length) return wantInPerson;
      var match = false;
      if (wantInPerson && formats.indexOf('in-person') !== -1) match = true;
      if (wantOnline && formats.indexOf('online') !== -1) match = true;
      if (wantHybrid && formats.indexOf('hybrid') !== -1) match = true;
      if (!match) return false;
    }

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
    while (industrySelect.options.length > 1) industrySelect.remove(1);
    var all = window.hubAllOrganisers || [];
    var labels = [];
    all.forEach(function (org) {
      (org.industries || []).forEach(function (ind) {
        if (ind && labels.indexOf(ind) === -1) labels.push(ind);
      });
    });
    labels.sort().forEach(function (label) {
      var opt = document.createElement('option');
      opt.value = String(label)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      opt.textContent = label;
      industrySelect.appendChild(opt);
    });
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
    if (checkInPerson) checkInPerson.checked = true;
    if (checkOnline) checkOnline.checked = true;
    if (checkHybrid) checkHybrid.checked = true;
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
    fillIndustryOptions();
    applyFilters();
  };
  window.hubResetOrganiserFilters = resetFilters;

  function bindFilter(el) {
    if (!el) return;
    el.addEventListener('input', applyFilters);
    el.addEventListener('change', applyFilters);
  }

  [searchInput, sortSelect, industrySelect, checkInPerson, checkOnline, checkHybrid].forEach(bindFilter);

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
