/**
 * Organiser browse — card grid on events page (organiser mode).
 */
(function () {
  var API = '/api/organisers';
  var PAGE_SIZE = 12;

  var els = {
    listings: document.getElementById('event-listings'),
    resultsCount: document.getElementById('results-count'),
    countAll: document.getElementById('org-count-all'),
    countFeatured: document.getElementById('org-count-featured'),
    loadOverlay: document.getElementById('events-load-overlay'),
  };

  var organisers = [];
  var currentPage = 1;

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function starsHtml(rating) {
    var avg = Number(rating);
    var full =
      Number.isFinite(avg) && avg > 0 ? Math.min(5, Math.max(0, Math.round(avg))) : 0;
    var html = '';
    for (var i = 1; i <= 5; i++) {
      html +=
        '<span class="star ' +
        (i <= full ? 'is-full' : '') +
        '" aria-hidden="true">★</span>';
    }
    return html;
  }

  function organiserHref(org) {
    if (org && org.id) {
      return 'organiser.html?id=' + encodeURIComponent(org.id);
    }
    var slug = org.slug ? String(org.slug).trim() : '';
    if (slug) return '/organisers/' + encodeURIComponent(slug);
    return 'organiser.html';
  }

  function logoHtml(org) {
    var url = org.photoUrl || '';
    var letter = String(org.name || '?').trim().charAt(0).toUpperCase() || '?';
    if (url) {
      return (
        '<img class="organiser-card-logo" src="' +
        escapeHtml(url) +
        '" alt="" loading="lazy" decoding="async" onerror="this.parentElement.innerHTML=\'<span class=organiser-card-logo-placeholder>' +
        escapeHtml(letter) +
        '</span>\'">'
      );
    }
    return '<span class="organiser-card-logo-placeholder" aria-hidden="true">' + escapeHtml(letter) + '</span>';
  }

  function listingCountLabel(n) {
    var count = Number(n) || 0;
    if (count === 0) return 'No listings yet';
    return count === 1 ? '1 listing' : count + ' listings';
  }

  function gridCard(org) {
    var industry = org.industry || (org.industries && org.industries[0]) || 'Networking';
    var desc = String(org.description || '').trim();
    if (desc.length > 160) desc = desc.slice(0, 157) + '…';
    var reviewCount = Number(org.reviews) || 0;

    return (
      '<article class="organiser-grid-card" data-id="' +
      escapeHtml(org.id) +
      '">' +
      '<div class="organiser-card-header">' +
      '<span class="organiser-card-industry">' +
      escapeHtml(industry) +
      '</span>' +
      '<span class="organiser-card-count">' +
      escapeHtml(listingCountLabel(org.eventCount)) +
      '</span>' +
      '<div class="organiser-card-logo-wrap">' +
      logoHtml(org) +
      '</div></div>' +
      '<div class="organiser-card-body">' +
      '<span class="organiser-card-label">Organiser</span>' +
      '<h3 class="organiser-card-name">' +
      escapeHtml(org.name) +
      '</h3>' +
      '<p class="organiser-card-desc">' +
      escapeHtml(desc || (Number(org.eventCount) ? 'Networking group on The Networker Hub.' : 'Profile coming soon — no listings yet.')) +
      '</p>' +
      '<div class="organiser-card-rating">' +
      '<span class="stars">' +
      starsHtml(org.rating) +
      '</span>' +
      '<span class="review-count">(' +
      reviewCount +
      ')</span></div>' +
      '<div class="organiser-card-footer">' +
      '<a class="organiser-card-cta" href="' +
      escapeHtml(organiserHref(org)) +
      '">More info</a></div></div></article>'
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
      '<button type="button" class="page-btn page-prev" data-page="' +
        (page - 1) +
        '" ' +
        (page <= 1 ? 'disabled' : '') +
        ' aria-label="Previous page">‹</button>'
    );

    if (start > 1) {
      items.push('<button type="button" class="page-btn" data-page="1">1</button>');
      if (start > 2) items.push('<span class="page-ellipsis" aria-hidden="true">…</span>');
    }

    for (var p = start; p <= end; p++) {
      items.push(
        '<button type="button" class="page-btn' +
          (p === page ? ' is-active' : '') +
          '" data-page="' +
          p +
          '" ' +
          (p === page ? 'aria-current="page"' : '') +
          '>' +
          p +
          '</button>'
      );
    }

    if (end < totalPages) {
      if (end < totalPages - 1) items.push('<span class="page-ellipsis" aria-hidden="true">…</span>');
      items.push(
        '<button type="button" class="page-btn" data-page="' + totalPages + '">' + totalPages + '</button>'
      );
    }

    items.push(
      '<button type="button" class="page-btn page-next" data-page="' +
        (page + 1) +
        '" ' +
        (page >= totalPages ? 'disabled' : '') +
        ' aria-label="Next page">›</button>'
    );

    return '<nav class="listings-pagination" aria-label="Organiser pages">' + items.join('') + '</nav>';
  }

  function getFilteredList() {
    return window.hubGetFilteredOrganisers
      ? window.hubGetFilteredOrganisers(organisers)
      : organisers.slice();
  }

  function updateCounts() {
    var all = window.hubAllOrganisers || organisers;
    if (window.hubGetFilteredOrganisers) {
      var allList = window.hubGetFilteredOrganisers(all, { tab: 'all' });
      var featured = window.hubGetFilteredOrganisers(all, { tab: 'featured' });
      if (els.countAll) els.countAll.textContent = '(' + allList.length + ')';
      if (els.countFeatured) els.countFeatured.textContent = '(' + featured.length + ')';
      return;
    }
    if (els.countAll) els.countAll.textContent = '(' + all.length + ')';
    if (els.countFeatured) {
      var f = all.filter(function (o) {
        return o.featured;
      }).length;
      els.countFeatured.textContent = '(' + f + ')';
    }
  }

  function renderGridPage(list) {
    var rows = list;
    var totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    var start = (currentPage - 1) * PAGE_SIZE;
    var pageItems = rows.slice(start, start + PAGE_SIZE);

    if (!els.listings) return;

    if (!rows.length) {
      els.listings.innerHTML =
        '<div class="empty-state is-visible" role="status">' +
        '<div class="empty-state-inner">' +
        '<h3 class="empty-state-title">No organisers match your filters</h3>' +
        '<p class="empty-state-text">Try clearing filters or searching for a different networking group.</p>' +
        '<button type="button" class="empty-state-btn" id="empty-reset">Clear all filters</button>' +
        '</div></div>';
      if (els.resultsCount) els.resultsCount.textContent = '0';
      return;
    }

    var rangeStart = start + 1;
    var rangeEnd = Math.min(start + PAGE_SIZE, rows.length);
    var rangeHtml =
      rows.length > PAGE_SIZE
        ? '<p class="listings-range">Showing ' +
          rangeStart +
          '–' +
          rangeEnd +
          ' of ' +
          rows.length +
          '</p>'
        : '';

    els.listings.innerHTML =
      rangeHtml +
      '<div class="organiser-grid">' +
      pageItems.map(gridCard).join('') +
      '</div>' +
      paginationHtml(currentPage, totalPages);

    if (els.resultsCount) els.resultsCount.textContent = String(rows.length);
  }

  function renderAll() {
    var filtered = getFilteredList();
    renderGridPage(filtered);
    updateCounts();
  }

  window.hubRefreshOrganiserListings = function () {
    currentPage = 1;
    renderAll();
  };

  window.hubRenderOrganisers = function () {
    renderAll();
  };

  function initPagination() {
    if (!els.listings || els.listings.dataset.orgPaginationBound) return;
    els.listings.dataset.orgPaginationBound = '1';
    els.listings.addEventListener('click', function (e) {
      var btn = e.target.closest('.page-btn');
      if (!btn || btn.disabled) return;
      var filtered = getFilteredList();
      var totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
      var p = parseInt(btn.getAttribute('data-page'), 10);
      if (!p || p === currentPage || p < 1 || p > totalPages) return;
      currentPage = p;
      renderGridPage(filtered);
    });
  }

  function setLoading(on) {
    if (window.hubLoading) {
      if (on) {
        window.hubLoading.show('events-load-overlay', {
          title: 'Loading organisers',
          message: 'Bear with us — almost there.',
        });
      } else {
        window.hubLoading.hide('events-load-overlay');
      }
      return;
    }
    if (!els.loadOverlay) return;
    els.loadOverlay.hidden = !on;
  }

  function applyLoadedOrganisers() {
    window.hubAllOrganisers = organisers;
    currentPage = 1;
    if (window.hubApplyOrganiserFilters) window.hubApplyOrganiserFilters();
    else renderAll();
  }

  var loadPromise = null;

  function loadOrganisers() {
    if (loadPromise) return loadPromise;
    if (organisers.length) {
      applyLoadedOrganisers();
      return Promise.resolve(organisers);
    }

    setLoading(true);
    loadPromise = fetch(API)
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (!data.configured) {
          organisers = [];
        } else if (data.error) {
          organisers = [];
        } else {
          organisers = data.organisers || [];
        }
        applyLoadedOrganisers();
        return organisers;
      })
      .catch(function () {
        organisers = [];
        applyLoadedOrganisers();
        return organisers;
      })
      .finally(function () {
        setLoading(false);
        loadPromise = null;
      });

    return loadPromise;
  }

  window.hubLoadOrganisers = loadOrganisers;
  initPagination();
})();
