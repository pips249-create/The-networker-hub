/**
 * Opportunities — paginated browse (scales to thousands of listings).
 */
(function () {
  var PAGE_SIZE = 36;
  var SEARCH_DEBOUNCE_MS = 200;

  var catalog = window.HubOpportunitiesCatalog;
  var saves = window.HubOpportunitySaves;

  var FAV_ICON =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>' +
    '</svg>';

  var allListings = [];
  var activeFilter = 'all';
  var searchQ = '';
  var currentPage = 1;
  var searchTimer = null;

  var els = {
    mount: document.getElementById('opp-listings-mount'),
    resultsCount: document.getElementById('opp-results-count'),
    filterBar: document.getElementById('opp-filter-bar'),
    search: document.getElementById('opp-search'),
  };

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function detailHref(item) {
    return catalog ? catalog.detailHref(item) : 'opportunity.html?id=' + encodeURIComponent(item.id);
  }

  function matchesFilter(item) {
    if (activeFilter !== 'all') {
      var tagHit = item.tags.indexOf(activeFilter) !== -1;
      var typeHit = item.type === activeFilter;
      if (!tagHit && !typeHit) return false;
    }
    if (searchQ && item.searchText.indexOf(searchQ) === -1) return false;
    return true;
  }

  function getFilteredList() {
    return allListings.filter(matchesFilter);
  }

  function sortListings(list) {
    return list.slice().sort(function (a, b) {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return a.title.localeCompare(b.title, 'en-GB');
    });
  }

  function isOpportunitySaved(id) {
    return saves ? saves.isSaved(id) : false;
  }

  function toggleOpportunitySave(id) {
    return saves ? saves.toggle(id) : false;
  }

  function refreshSaveButtons(root) {
    if (saves) saves.refreshButtons(root);
  }

  function cardHtml(item) {
    var href = detailHref(item);
    var typeLabels = catalog ? catalog.TYPE_LABELS : {};
    var typeClassFn = catalog ? catalog.typeClass.bind(catalog) : function () {
      return 'opp-type-franchise';
    };

    var metaHtml = (item.meta || [])
      .slice(0, 3)
      .map(function (m) {
        return (
          '<span class="opp-fact"><span class="opp-fact-key">' +
          escapeHtml(m.key) +
          '</span> ' +
          escapeHtml(m.val) +
          '</span>'
        );
      })
      .join('');

    return (
      '<article class="opp-card' +
      (item.featured ? ' featured' : '') +
      '" data-type="' +
      escapeHtml(item.type) +
      '">' +
      '<button type="button" class="opp-fav-btn' +
      (isOpportunitySaved(item.id) ? ' is-active' : '') +
      '" data-opp-id="' +
      escapeHtml(item.id) +
      '" aria-label="' +
      (isOpportunitySaved(item.id) ? 'Remove from saved' : 'Save opportunity') +
      '" aria-pressed="' +
      (isOpportunitySaved(item.id) ? 'true' : 'false') +
      '">' +
      FAV_ICON +
      '</button>' +
      '<div class="opp-card-top">' +
      '<span class="opp-type-badge ' +
      typeClassFn(item.type) +
      '">' +
      escapeHtml(typeLabels[item.type] || item.type) +
      '</span>' +
      (item.featured ? '<span class="opp-featured-pip">Featured</span>' : '') +
      '</div>' +
      '<div class="opp-card-body">' +
      '<div class="opp-card-identity">' +
      '<div class="opp-host-logo" style="background:' +
      escapeHtml(item.hostColor) +
      '" aria-hidden="true">' +
      escapeHtml(item.hostInitials) +
      '</div>' +
      '<div class="opp-card-identity-text">' +
      '<h3 class="opp-card-title"><a href="' +
      escapeHtml(href) +
      '">' +
      escapeHtml(item.title) +
      '</a></h3>' +
      '<p class="opp-card-host">' +
      escapeHtml(item.host) +
      '</p>' +
      '</div></div>' +
      '<p class="opp-card-desc">' +
      escapeHtml(item.desc) +
      '</p>' +
      '<div class="opp-card-facts">' +
      metaHtml +
      '</div>' +
      '</div>' +
      '<a href="' +
      escapeHtml(href) +
      '" class="opp-enquire">Enquire →</a>' +
      '</article>'
    );
  }

  function paginationHtml(page, totalPages) {
    if (totalPages <= 1) return '';

    var items = [];
    var maxVisible = 5;
    var start = Math.max(1, page - 2);
    var end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);

    items.push(
      '<button type="button" class="opp-page-btn opp-page-prev" data-page="' +
        (page - 1) +
        '"' +
        (page <= 1 ? ' disabled' : '') +
        ' aria-label="Previous page">‹</button>'
    );

    if (start > 1) {
      items.push('<button type="button" class="opp-page-btn" data-page="1">1</button>');
      if (start > 2) items.push('<span class="opp-page-ellipsis" aria-hidden="true">…</span>');
    }

    for (var p = start; p <= end; p++) {
      items.push(
        '<button type="button" class="opp-page-btn' +
          (p === page ? ' is-active' : '') +
          '" data-page="' +
          p +
          '"' +
          (p === page ? ' aria-current="page"' : '') +
          '>' +
          p +
          '</button>'
      );
    }

    if (end < totalPages) {
      if (end < totalPages - 1) items.push('<span class="opp-page-ellipsis" aria-hidden="true">…</span>');
      items.push('<button type="button" class="opp-page-btn" data-page="' + totalPages + '">' + totalPages + '</button>');
    }

    items.push(
      '<button type="button" class="opp-page-btn opp-page-next" data-page="' +
        (page + 1) +
        '"' +
        (page >= totalPages ? ' disabled' : '') +
        ' aria-label="Next page">›</button>'
    );

    return '<nav class="opp-pagination" aria-label="Opportunity pages">' + items.join('') + '</nav>';
  }

  function updateResultsCount(total, rangeStart, rangeEnd) {
    if (!els.resultsCount) return;
    if (!total) {
      els.resultsCount.textContent = 'No listings match your filters';
      return;
    }
    if (total <= PAGE_SIZE) {
      els.resultsCount.textContent = total + (total === 1 ? ' opportunity' : ' opportunities');
      return;
    }
    els.resultsCount.textContent = 'Showing ' + rangeStart + '–' + rangeEnd + ' of ' + total + ' opportunities';
  }

  function renderListings() {
    if (!els.mount) return;

    var filtered = sortListings(getFilteredList());
    var totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    var start = (currentPage - 1) * PAGE_SIZE;
    var pageItems = filtered.slice(start, start + PAGE_SIZE);

    if (!filtered.length) {
      els.mount.innerHTML =
        '<div class="opp-no-results is-visible" role="status">' +
        '<h3>No listings match your search</h3>' +
        '<p>Try adjusting your filters or <button type="button" class="opp-clear-btn" id="opp-clear-filters">clear all</button>.</p>' +
        '</div>';
      updateResultsCount(0, 0, 0);
      bindClearFilters();
      return;
    }

    var rangeStart = start + 1;
    var rangeEnd = Math.min(start + PAGE_SIZE, filtered.length);

    els.mount.innerHTML =
      '<div class="opp-opps-grid">' +
      pageItems.map(cardHtml).join('') +
      '</div>' +
      paginationHtml(currentPage, totalPages);

    updateResultsCount(filtered.length, rangeStart, rangeEnd);
    refreshSaveButtons(els.mount);
  }

  function bindClearFilters() {
    var btn = document.getElementById('opp-clear-filters');
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', resetFilters);
  }

  function setFilter(filter) {
    activeFilter = filter;
    currentPage = 1;
    if (els.filterBar) {
      els.filterBar.querySelectorAll('.opp-filter-btn').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-filter') === filter);
      });
    }
    renderListings();
  }

  function updateSearchClearVisibility() {
    var clearBtn = document.getElementById('opp-search-clear');
    if (!clearBtn || !els.search) return;
    clearBtn.hidden = !els.search.value.trim();
  }

  function resetFilters() {
    activeFilter = 'all';
    searchQ = '';
    currentPage = 1;
    if (els.search) els.search.value = '';
    updateSearchClearVisibility();
    setFilter('all');
  }

  function submitForm(btn) {
    btn.textContent = "✓ Submitted — we'll be in touch within 24 hours";
    btn.style.background = '#166534';
    btn.style.color = '#fff';
    btn.disabled = true;
  }

  function initFilters() {
    if (!els.filterBar || els.filterBar.dataset.bound) return;
    els.filterBar.dataset.bound = '1';

    els.filterBar.addEventListener('click', function (e) {
      var btn = e.target.closest('.opp-filter-btn');
      if (!btn) return;
      setFilter(btn.getAttribute('data-filter') || 'all');
    });

    if (els.search) {
      els.search.addEventListener('input', function () {
        var val = els.search.value.trim().toLowerCase();
        updateSearchClearVisibility();
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
          searchQ = val;
          currentPage = 1;
          renderListings();
        }, SEARCH_DEBOUNCE_MS);
      });
    }

    var clearBtn = document.getElementById('opp-search-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (els.search) {
          els.search.value = '';
          els.search.focus();
        }
        searchQ = '';
        currentPage = 1;
        updateSearchClearVisibility();
        renderListings();
      });
    }
  }

  function initPagination() {
    if (!els.mount || els.mount.dataset.paginationBound) return;
    els.mount.dataset.paginationBound = '1';

    els.mount.addEventListener('click', function (e) {
      var fav = e.target.closest('.opp-fav-btn');
      if (fav) {
        e.preventDefault();
        e.stopPropagation();
        toggleOpportunitySave(fav.getAttribute('data-opp-id'));
        refreshSaveButtons(els.mount);
        return;
      }

      var btn = e.target.closest('.opp-page-btn');
      if (!btn || btn.disabled) return;
      var filtered = getFilteredList();
      var totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
      var p = parseInt(btn.getAttribute('data-page'), 10);
      if (!p || p === currentPage || p < 1 || p > totalPages) return;
      currentPage = p;
      renderListings();
      var browse = document.getElementById('browse');
      if (browse) browse.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var target = document.querySelector(a.getAttribute('href'));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  function init() {
    allListings = catalog ? catalog.loadCatalog() : [];
    initFilters();
    initPagination();
    initSmoothScroll();
    renderListings();
  }

  window.submitForm = submitForm;
  window.resetFilters = resetFilters;

  window.hubRenderOpportunities = function (listings) {
    if (!catalog) return;
    allListings = (listings || []).map(function (item, i) {
      var normalized = catalog.normalizeListing(item, i);
      if (!normalized.searchText) normalized.searchText = catalog.buildSearchText(normalized);
      return normalized;
    });
    currentPage = 1;
    renderListings();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
