/**
 * Opportunities — paginated browse (scales to thousands of listings).
 */
(function () {
  var PAGE_SIZE = 36;
  var SEARCH_DEBOUNCE_MS = 200;

  var TYPE_LABELS = {
    franchise: 'Franchise',
    'side-hustle': 'Side hustle',
    partnership: 'Partnership',
  };

  var SEED_LISTINGS = [
    {
      type: 'franchise',
      tags: ['franchise'],
      featured: true,
      host: 'Sparkle & Shine Ltd',
      hostInitials: 'SS',
      hostColor: '#7a5c0a',
      title: 'Domestic Cleaning Franchise — Full Territory',
      desc: 'Proven 12-year model. Full training, CRM, and branded materials. Territories across Yorkshire and the Midlands.',
      meta: [
        { key: 'Investment', val: '£9,500' },
        { key: 'Return', val: '18–24 mo' },
        { key: 'Location', val: 'Yorkshire' },
      ],
    },
    {
      type: 'side-hustle',
      tags: ['side-hustle', 'remote', 'low-invest'],
      featured: false,
      host: 'Flat Lay Studio',
      hostInitials: 'FL',
      hostColor: '#0d5a52',
      title: 'Branded Product Photography — Reseller Model',
      desc: 'Edit product photos for e-commerce brands from home. Flexible hours; paid per project.',
      meta: [
        { key: 'Investment', val: '£0' },
        { key: 'Earnings', val: '£400–£900/mo' },
        { key: 'Location', val: 'Remote' },
      ],
    },
    {
      type: 'franchise',
      tags: ['franchise'],
      featured: false,
      host: 'GreenBox Foods',
      hostInitials: 'GB',
      hostColor: '#166534',
      title: 'Health Food Kiosk — Shopping Centres',
      desc: 'Compact kiosk format for high-footfall retail. Full supply chain, POS, and branded packaging.',
      meta: [
        { key: 'Investment', val: '£22,000' },
        { key: 'Return', val: '6–12 mo' },
        { key: 'Spaces', val: '4 left' },
      ],
    },
    {
      type: 'partnership',
      tags: ['partnership', 'remote', 'low-invest'],
      featured: false,
      host: 'Bolt Digital Agency',
      hostInitials: 'BD',
      hostColor: '#1d4ed8',
      title: 'White-Label Web Design — Agency Reseller',
      desc: 'Sell websites under your own brand. We build, you bill. Ideal for consultants and coaches.',
      meta: [
        { key: 'Investment', val: '£0' },
        { key: 'Commission', val: '25–40%' },
        { key: 'Location', val: 'Remote' },
      ],
    },
    {
      type: 'franchise',
      tags: ['franchise'],
      featured: false,
      host: 'Pawfect Groom',
      hostInitials: 'PG',
      hostColor: '#6b21a8',
      title: 'Dog Grooming Franchise — Mobile Van',
      desc: 'Fully kitted mobile grooming van in your postcode. Training, booking software, and branding included.',
      meta: [
        { key: 'Investment', val: '£14,500' },
        { key: 'Return', val: '12 mo' },
        { key: 'Vans', val: '6 left' },
      ],
    },
    {
      type: 'side-hustle',
      tags: ['side-hustle', 'low-invest'],
      featured: false,
      host: 'ClearLedger UK',
      hostInitials: 'CL',
      hostColor: '#374151',
      title: 'Bookkeeping Partner — Sole Traders & SMEs',
      desc: 'Licensed partner model for local small businesses. Ideal for those with admin or accounting experience.',
      meta: [
        { key: 'Investment', val: '£1,800' },
        { key: 'Earnings', val: '£1.2–3k/mo' },
        { key: 'Location', val: 'Your area' },
      ],
    },
  ];

  var REGIONS = [
    'Yorkshire',
    'Manchester',
    'Birmingham',
    'London',
    'Bristol',
    'Scotland',
    'Wales',
    'Remote',
    'UK-wide',
    'Leeds',
    'Liverpool',
    'Newcastle',
  ];

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

  function buildSearchText(item) {
    return [item.title, item.host, item.desc, item.type]
      .concat(item.tags || [])
      .concat((item.meta || []).map(function (m) {
        return m.key + ' ' + m.val;
      }))
      .join(' ')
      .toLowerCase();
  }

  function normalizeListing(seed, index) {
    var item = Object.assign({}, seed);
    item.id = 'opp-' + (index + 1);
    item.tags = (seed.tags || []).slice();
    item.meta = (seed.meta || []).map(function (m) {
      return { key: m.key, val: m.val };
    });
    item.searchText = buildSearchText(item);
    return item;
  }

  function expandCatalog(seeds, count) {
    var out = [];
    for (var i = 0; i < count; i++) {
      var seed = seeds[i % seeds.length];
      var item = normalizeListing(seed, i);
      if (i >= seeds.length) {
        var region = REGIONS[i % REGIONS.length];
        item.title = seed.title.replace(/—.*/, '— ' + region);
        if (item.meta.length > 2) {
          item.meta[2] = { key: 'Location', val: region };
        }
        item.featured = i < 3;
        item.searchText = buildSearchText(item);
      }
      out.push(item);
    }
    return out;
  }

  function resolveCatalogSize() {
    var param = new URLSearchParams(window.location.search).get('listings');
    var n = parseInt(param, 10);
    if (n > 0) return Math.min(n, 5000);
    return SEED_LISTINGS.length;
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

  function typeClass(type) {
    if (type === 'side-hustle') return 'opp-type-sidehustle';
    if (type === 'partnership') return 'opp-type-partnership';
    return 'opp-type-franchise';
  }

  function cardHtml(item) {
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
      '<div class="opp-card-head">' +
      '<span class="opp-type-badge ' +
      typeClass(item.type) +
      '">' +
      escapeHtml(TYPE_LABELS[item.type] || item.type) +
      '</span>' +
      (item.featured ? '<span class="opp-featured-pip">Featured</span>' : '') +
      '</div>' +
      '<div class="opp-card-body">' +
      '<h3 class="opp-card-title">' +
      escapeHtml(item.title) +
      '</h3>' +
      '<p class="opp-card-host">' +
      '<span class="opp-host-avatar" style="background:' +
      escapeHtml(item.hostColor) +
      '">' +
      escapeHtml(item.hostInitials) +
      '</span>' +
      escapeHtml(item.host) +
      '</p>' +
      '<p class="opp-card-desc">' +
      escapeHtml(item.desc) +
      '</p>' +
      '<div class="opp-card-facts">' +
      metaHtml +
      '</div>' +
      '</div>' +
      '<a href="mailto:hello@the-networker.co.uk?subject=' +
      encodeURIComponent('Opportunity enquiry: ' + item.title) +
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

  function resetFilters() {
    activeFilter = 'all';
    searchQ = '';
    currentPage = 1;
    if (els.search) els.search.value = '';
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
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
          searchQ = val;
          currentPage = 1;
          renderListings();
        }, SEARCH_DEBOUNCE_MS);
      });
    }
  }

  function initPagination() {
    if (!els.mount || els.mount.dataset.paginationBound) return;
    els.mount.dataset.paginationBound = '1';

    els.mount.addEventListener('click', function (e) {
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
    allListings = expandCatalog(SEED_LISTINGS, resolveCatalogSize());
    initFilters();
    initPagination();
    initSmoothScroll();
    renderListings();
  }

  window.submitForm = submitForm;
  window.resetFilters = resetFilters;
  window.hubRenderOpportunities = function (listings) {
    allListings = (listings || []).map(function (item, i) {
      var normalized = normalizeListing(item, i);
      if (!normalized.searchText) normalized.searchText = buildSearchText(normalized);
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
