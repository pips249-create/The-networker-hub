/**
 * /testing-bo — Business opportunities browse using events filter bar + event-grid cards.
 */
(function () {
  var PAGE_SIZE = 12;
  var SEARCH_DEBOUNCE_MS = 200;
  var SPOTLIGHT_MAX = 12;
  var SPOTLIGHT_AUTO_MS = 2800;

  var TYPE_CHIPS = [
    { id: 'all', label: 'All' },
    { id: 'franchise', label: 'Franchise' },
    { id: 'side-hustle', label: 'Side hustle' },
    { id: 'partnership', label: 'Partnership / Affiliate' },
    { id: 'networking', label: 'Networking group / Ambassador' },
    { id: 'business-opportunity', label: 'Business opportunity' },
    { id: 'distributorship', label: 'Distributorship / Reseller' },
  ];

  var INVEST_LABELS = {
    all: 'All budgets',
    'low-invest': 'Under £2.5k',
    'mid-invest': '£2.5k–£10k',
    'high-invest': '£10k+',
  };

  var COMMITMENTS = [
    { id: 'full-time', label: 'Full-time' },
    { id: 'part-time', label: 'Part-time / Flexible' },
    { id: 'event-based', label: 'Event-based' },
  ];

  var catalog = window.HubOpportunitiesCatalog;
  var saves = window.HubOpportunitySaves;
  var quality = window.HubOpportunityQuality;
  var expandedCardId = null;

  var FAV_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>';

  var allListings = [];
  var activeTypes = [];
  var activeInvestTier = 'all';
  var activeCategory = '';
  var activeCommitments = [];
  var locationQ = '';
  var searchQ = '';
  var sortBy = 'recommended';
  var minInvest = null;
  var maxInvest = null;
  var currentPage = 1;
  var spotlightFeaturedOrder = null;
  var spotlightTimer = null;
  var spotlightAnimating = false;
  var spotlightCarouselBound = false;
  var searchTimer = null;

  var els = {};

  function cacheEls() {
    els.listings = document.getElementById('event-listings');
    els.resultsCount = document.getElementById('results-count');
    els.search = document.getElementById('search');
    els.sort = document.getElementById('sort');
    els.postcode = document.getElementById('postcode');
    els.typeChipsRoot = document.getElementById('opp-type-chips');
    els.category = document.getElementById('opp-filter-category');
    els.minInvest = document.getElementById('opp-min-invest');
    els.maxInvest = document.getElementById('opp-max-invest');
    els.moreToggle = document.getElementById('filter-more-toggle');
    els.morePanel = document.getElementById('filter-more-panel');
    els.clearBar = document.getElementById('clear-filters-bar');
    els.clearResults = document.getElementById('clear-filters');
    els.spotlightTrack = document.getElementById('spotlight-track');
    els.spotlightSection = document.querySelector('.premium-spotlight');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function detailHref(item) {
    var slug = item.slug ? String(item.slug).trim() : '';
    if (slug) return '/opportunities/' + encodeURIComponent(slug);
    return '/opportunities/opportunity?id=' + encodeURIComponent(item.id);
  }

  function hasTag(item, tag) {
    if (!tag) return true;
    if (item.type === tag) return true;
    return (item.filterTags || []).indexOf(tag) !== -1;
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

  function investmentLabel(item) {
    if (catalog && catalog.cardDisplayMeta) {
      var meta = catalog.cardDisplayMeta(item);
      for (var i = 0; i < meta.length; i++) {
        if (/investment/i.test(meta[i].key) && meta[i].val) return String(meta[i].val);
      }
    }
    if (item.investAmount != null && !isNaN(item.investAmount)) {
      if (item.investAmount <= 0) return 'Enquire';
      if (item.investAmount >= 1000) return 'From £' + Math.round(item.investAmount / 1000) + 'k';
      return 'From £' + item.investAmount;
    }
    return 'Enquire';
  }

  function commitmentLabel(item) {
    var tags = item.filterTags || [];
    for (var i = 0; i < COMMITMENTS.length; i++) {
      if (tags.indexOf(COMMITMENTS[i].id) !== -1) return COMMITMENTS[i].label;
    }
    return 'Flexible';
  }

  function investTierClass(tier) {
    if (tier === 'low-invest') return 'investment-low';
    if (tier === 'mid-invest') return 'investment-mid';
    if (tier === 'high-invest') return 'investment-high';
    return 'investment-mid';
  }

  function detectInvestTier(item) {
    var amount = item.investAmount;
    if (amount == null || isNaN(amount)) {
      if (hasTag(item, 'low-invest')) return 'low-invest';
      if (hasTag(item, 'mid-invest')) return 'mid-invest';
      if (hasTag(item, 'high-invest')) return 'high-invest';
      return 'mid-invest';
    }
    if (amount <= 2500) return 'low-invest';
    if (amount <= 10000) return 'mid-invest';
    return 'high-invest';
  }

  function mediaHtml(item, thumb) {
    if (item.imageUrl) {
      var logoClass = item.logoUrl ? ' is-logo-cover' : '';
      return (
        '<img class="event-grid-img' +
        logoClass +
        '" src="' +
        escapeHtml(item.imageUrl) +
        '" alt="" loading="lazy" decoding="async" />'
      );
    }
    return (
      '<div class="event-grid-img is-placeholder" style="display:flex;align-items:center;justify-content:center;background:' +
      escapeHtml(thumb.gradient) +
      ';font-size:2.4rem">' +
      thumb.emoji +
      '</div>'
    );
  }

  function formatMetaVal(key, val) {
    if (catalog && catalog.formatMetaDisplayValue) {
      return catalog.formatMetaDisplayValue(key, val);
    }
    return val;
  }

  function metaCellHtml(m, item) {
    var scarcity = catalog && catalog.isScarcityMeta(m.key, m.val);
    var isInvestment = /^investment$/i.test(m.key);
    var investUi = window.HubOpportunityInvestment;
    var infoBtn =
      isInvestment && investUi && item ? investUi.infoButtonHtml(item) : '';
    return (
      '<div class="opp-meta-cell' +
      (scarcity ? ' opp-meta-cell--scarcity' : '') +
      (isInvestment && infoBtn ? ' opp-meta-cell--has-invest-info' : '') +
      '"><span class="opp-meta-k">' +
      escapeHtml(m.key) +
      '</span><span class="opp-meta-v-wrap"><span class="opp-meta-v">' +
      escapeHtml(formatMetaVal(m.key, m.val)) +
      '</span>' +
      infoBtn +
      '</span></div>'
    );
  }

  function companyAvatarHtml(item) {
    var logo = item.logoUrl || '';
    if (logo) {
      return (
        '<div class="opp-co-avatar opp-co-avatar--logo" aria-hidden="true">' +
        '<img src="' +
        escapeHtml(logo) +
        '" alt="" width="24" height="24" loading="lazy" decoding="async" />' +
        '</div>'
      );
    }
    return (
      '<div class="opp-co-avatar" style="background:' +
      escapeHtml(item.hostColor || '#c9961f') +
      '" aria-hidden="true">' +
      escapeHtml(item.hostInitials || '?') +
      '</div>'
    );
  }

  function cardDetailHtml(item) {
    var href = detailHref(item);
    var displayMeta = catalog ? catalog.cardDisplayMeta(item) : (item.meta || []).slice(0, 4);
    var locIcon = /remote/i.test(item.locationLabel || '') ? '🌐' : '📍';

    while (displayMeta.length < 4) {
      displayMeta.push({ key: '\u00a0', val: '—' });
    }

    return (
      '<div class="bo-opp-detail-inner">' +
      '<div class="opp-company">' +
      companyAvatarHtml(item) +
      '<span class="opp-co-name">' +
      escapeHtml(item.host || 'Provider') +
      '</span></div>' +
      '<p class="opp-card-desc">' +
      escapeHtml(item.desc || '') +
      '</p>' +
      (quality && quality.trustBadgesHtml
        ? quality.trustBadgesHtml(item, 'opp-trust-badges opp-trust-badges--card')
        : '') +
      '<div class="opp-meta-row">' +
      displayMeta
        .map(function (m) {
          return metaCellHtml(m, item);
        })
        .join('') +
      '</div>' +
      '<div class="bo-opp-detail-footer">' +
      '<span class="opp-location">' +
      locIcon +
      ' ' +
      escapeHtml(item.locationLabel || 'UK') +
      '</span>' +
      '<a href="' +
      escapeHtml(href) +
      '" class="opp-enquire-btn">Enquire →</a>' +
      '</div></div>'
    );
  }

  function gridCard(item) {
    var href = detailHref(item);
    var typeLabels = catalog ? catalog.TYPE_LABELS : {};
    var typeLabel = typeLabels[item.type] || item.type || 'Opportunity';
    var thumb = item.thumb || { emoji: '✦', gradient: 'linear-gradient(135deg,#fdf6e3,#f5e0a0)' };
    var invest = investmentLabel(item);
    var commitment = commitmentLabel(item);
    var tier = detectInvestTier(item);
    var metaLine = [item.locationLabel || 'UK', invest].filter(Boolean).join(' · ');
    var premiumBadge = item.featured ? '<span class="event-grid-premium">Premium</span>' : '';
    var detailId = 'bo-opp-detail-' + String(item.id).replace(/[^a-z0-9_-]/gi, '');

    return (
      '<article class="event-grid-card bo-opp-card' +
      (item.featured ? ' is-premium' : '') +
      '" data-id="' +
      escapeHtml(item.id) +
      '">' +
      '<div class="bo-opp-compact">' +
      '<div class="event-grid-media">' +
      mediaHtml(item, thumb) +
      premiumBadge +
      '<span class="event-grid-category">' +
      escapeHtml(typeLabel) +
      '</span></div>' +
      '<div class="event-grid-body">' +
      '<div class="event-grid-body-top">' +
      '<span class="event-grid-format ' +
      investTierClass(tier) +
      '">' +
      escapeHtml(commitment) +
      '</span>' +
      '<span class="event-grid-price">' +
      escapeHtml(invest) +
      '</span></div>' +
      '<h3 class="event-grid-title">' +
      escapeHtml(item.title) +
      '</h3>' +
      '<div class="event-grid-rating">' +
      '<span class="event-grid-host">' +
      escapeHtml(item.host || 'Provider') +
      '</span>' +
      '<button type="button" class="fav-btn opp-fav-btn' +
      (saves && saves.isSaved(item.id) ? ' is-active' : '') +
      '" data-opp-id="' +
      escapeHtml(item.id) +
      '" aria-label="' +
      (saves && saves.isSaved(item.id) ? 'Remove from saved' : 'Save opportunity') +
      '" aria-pressed="' +
      (saves && saves.isSaved(item.id) ? 'true' : 'false') +
      '">' +
      FAV_ICON +
      '</button></div>' +
      '<p class="event-grid-meta">' +
      escapeHtml(metaLine) +
      '</p>' +
      '<button type="button" class="bo-opp-expand-btn" aria-expanded="false" aria-controls="' +
      escapeHtml(detailId) +
      '">' +
      '<span class="bo-opp-expand-label">Show full details</span>' +
      '<svg class="bo-opp-expand-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>' +
      '</button></div></div>' +
      '<div class="bo-opp-detail" id="' +
      escapeHtml(detailId) +
      '" hidden>' +
      cardDetailHtml(item) +
      '</div>' +
      '<a class="event-grid-card-link" href="' +
      escapeHtml(href) +
      '" aria-label="View ' +
      escapeHtml(item.title) +
      '"></a></article>'
    );
  }

  function setCardExpanded(card, expand) {
    if (!card) return;
    var btn = card.querySelector('.bo-opp-expand-btn');
    var detail = card.querySelector('.bo-opp-detail');
    var label = btn && btn.querySelector('.bo-opp-expand-label');
    var id = card.getAttribute('data-id');

    card.classList.toggle('is-expanded', expand);
    if (detail) detail.hidden = !expand;
    if (btn) {
      btn.setAttribute('aria-expanded', expand ? 'true' : 'false');
      if (label) label.textContent = expand ? 'Hide full details' : 'Show full details';
    }
    expandedCardId = expand ? id : null;
  }

  function bindCardExpand() {
    if (!els.listings || els.listings.dataset.expandBound === '1') return;
    els.listings.dataset.expandBound = '1';

    els.listings.addEventListener('click', function (e) {
      var btn = e.target.closest('.bo-opp-expand-btn');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();

      var card = btn.closest('.bo-opp-card');
      if (!card) return;

      var willExpand = !card.classList.contains('is-expanded');
      els.listings.querySelectorAll('.bo-opp-card.is-expanded').forEach(function (openCard) {
        if (openCard !== card) setCardExpanded(openCard, false);
      });
      setCardExpanded(card, willExpand);

      if (willExpand && window.HubOpportunityInvestment && window.HubOpportunityInvestment.bindCardPopovers) {
        window.HubOpportunityInvestment.bindCardPopovers(function (lookupId) {
          for (var i = 0; i < allListings.length; i++) {
            if (String(allListings[i].id) === String(lookupId)) return allListings[i];
          }
          return null;
        });
      }
    });
  }

  function restoreExpandedCard() {
    if (!expandedCardId || !els.listings) return;
    var card = els.listings.querySelector('.bo-opp-card[data-id="' + expandedCardId + '"]');
    if (card) setCardExpanded(card, true);
  }

  function matchesLocation(item) {
    if (!locationQ) return true;
    var hay = [item.locationLabel, item.searchText, item.title, item.host, (item.tags || []).join(' ')]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.indexOf(locationQ) !== -1;
  }

  function matchesInvestTier(item) {
    if (!activeInvestTier || activeInvestTier === 'all') return true;
    return hasTag(item, activeInvestTier);
  }

  function matchesCommitments(item) {
    if (!activeCommitments.length) return true;
    for (var i = 0; i < activeCommitments.length; i++) {
      if (hasTag(item, activeCommitments[i])) return true;
    }
    return false;
  }

  function matchesTypes(item) {
    if (!activeTypes.length) return true;
    for (var i = 0; i < activeTypes.length; i++) {
      if (hasTag(item, activeTypes[i])) return true;
    }
    return false;
  }

  function matchesFilter(item) {
    if (!matchesTypes(item)) return false;
    if (activeCategory && item.category !== activeCategory) return false;
    if (!matchesInvestTier(item)) return false;
    if (!matchesCommitments(item)) return false;
    if (!matchesLocation(item)) return false;
    if (searchQ && item.searchText.indexOf(searchQ) === -1) return false;
    if (minInvest !== null && (item.investAmount === null || item.investAmount < minInvest)) return false;
    if (maxInvest !== null && (item.investAmount === null || item.investAmount > maxInvest)) return false;
    return true;
  }

  function getFilteredList() {
    return allListings.filter(matchesFilter);
  }

  function sortListings(list) {
    var sorted = list.slice();
    sorted.sort(function (a, b) {
      if (sortBy === 'recommended') {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return a.title.localeCompare(b.title, 'en-GB');
      }
      if (sortBy === 'invest-asc') return (a.investAmount || 0) - (b.investAmount || 0);
      if (sortBy === 'invest-desc') return (b.investAmount || 0) - (a.investAmount || 0);
      if (sortBy === 'alpha') return a.title.localeCompare(b.title, 'en-GB');
      return 0;
    });
    return sorted;
  }

  function countBy(predicate) {
    var n = 0;
    for (var i = 0; i < allListings.length; i++) {
      if (predicate(allListings[i])) n++;
    }
    return n;
  }

  function updateTypeChipCounts() {
    if (!els.typeChipsRoot) return;
    els.typeChipsRoot.querySelectorAll('.event-type-chip[data-type]').forEach(function (chip) {
      var type = chip.getAttribute('data-type') || 'all';
      var countEl = chip.querySelector('.event-type-chip-count');
      if (!countEl) return;
      var n =
        type === 'all'
          ? allListings.length
          : countBy(function (item) {
              return hasTag(item, type);
            });
      countEl.textContent = '(' + n + ')';
    });
  }

  function syncTypeChipUi() {
    if (!els.typeChipsRoot) return;
    var hasSelection = activeTypes.length > 0;
    els.typeChipsRoot.querySelectorAll('.event-type-chip[data-type]').forEach(function (chip) {
      var type = chip.getAttribute('data-type') || 'all';
      var active = type === 'all' ? !hasSelection : activeTypes.indexOf(type) !== -1;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function toggleType(type) {
    type = type || 'all';
    if (type === 'all') {
      activeTypes = [];
    } else {
      var idx = activeTypes.indexOf(type);
      if (idx >= 0) activeTypes.splice(idx, 1);
      else activeTypes.push(type);
    }
    syncTypeChipUi();
  }

  function buildTypeChips() {
    if (!els.typeChipsRoot) return;
    els.typeChipsRoot.innerHTML = TYPE_CHIPS.map(function (chip, index) {
      return (
        '<button type="button" class="event-type-chip' +
        (index === 0 ? ' is-active' : '') +
        '" data-type="' +
        escapeHtml(chip.id) +
        '" aria-pressed="' +
        (index === 0 ? 'true' : 'false') +
        '">' +
        escapeHtml(chip.label) +
        ' <span class="event-type-chip-count">(0)</span></button>'
      );
    }).join('');
    els.typeChipsRoot.querySelectorAll('.event-type-chip[data-type]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        toggleType(chip.getAttribute('data-type') || 'all');
        applyFilters();
      });
    });
    updateTypeChipCounts();
  }

  function syncInvestPills() {
    document.querySelectorAll('input[data-invest-tier]').forEach(function (input) {
      var tier = input.getAttribute('data-invest-tier') || 'all';
      input.checked = tier === activeInvestTier;
    });
  }

  function syncCommitmentChecks() {
    document.querySelectorAll('[data-commitment]').forEach(function (input) {
      var id = input.getAttribute('data-commitment');
      input.checked = activeCommitments.indexOf(id) !== -1;
    });
  }

  function readInvestRange() {
    minInvest = els.minInvest && els.minInvest.value !== '' ? Number(els.minInvest.value) : null;
    maxInvest = els.maxInvest && els.maxInvest.value !== '' ? Number(els.maxInvest.value) : null;
    if (minInvest != null && isNaN(minInvest)) minInvest = null;
    if (maxInvest != null && isNaN(maxInvest)) maxInvest = null;
  }

  function readFiltersFromControls() {
    searchQ = els.search ? String(els.search.value || '').trim().toLowerCase() : '';
    sortBy = els.sort ? els.sort.value : 'recommended';
    locationQ = els.postcode ? String(els.postcode.value || '').trim().toLowerCase() : '';
    activeCategory = els.category ? String(els.category.value || '').trim() : '';
    readInvestRange();
  }

  function updateResultsCount(total) {
    if (!els.resultsCount) return;
    els.resultsCount.textContent = String(total);
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
        '"' +
        (page <= 1 ? ' disabled' : '') +
        ' aria-label="Previous page">‹</button>'
    );

    for (var p = start; p <= end; p++) {
      items.push(
        '<button type="button" class="page-btn' +
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

    items.push(
      '<button type="button" class="page-btn page-next" data-page="' +
        (page + 1) +
        '"' +
        (page >= totalPages ? ' disabled' : '') +
        ' aria-label="Next page">›</button>'
    );

    return '<nav class="listings-pagination" aria-label="Opportunity pages">' + items.join('') + '</nav>';
  }

  function renderListings() {
    if (!els.listings) return;

    var filtered = sortListings(getFilteredList());
    var total = filtered.length;
    var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    updateResultsCount(total);
    updateTypeChipCounts();

    if (!total) {
      els.listings.innerHTML =
        '<div class="events-empty" role="status"><p>No opportunities match your filters. <button type="button" class="clear-filters-link" id="empty-clear-filters">Clear filters</button></p></div>';
      var emptyClear = document.getElementById('empty-clear-filters');
      if (emptyClear) emptyClear.addEventListener('click', resetFilters);
      return;
    }

    var start = (currentPage - 1) * PAGE_SIZE;
    var slice = filtered.slice(start, start + PAGE_SIZE);

    els.listings.innerHTML =
      '<div class="event-grid">' +
      slice.map(gridCard).join('') +
      '</div>' +
      paginationHtml(currentPage, totalPages);

    if (saves) saves.refreshButtons(els.listings);
    bindCardExpand();
    restoreExpandedCard();
  }

  function applyFilters() {
    readFiltersFromControls();
    currentPage = 1;
    renderListings();
    renderSpotlight();
  }

  function resetFilters() {
    activeTypes = [];
    activeInvestTier = 'all';
    activeCategory = '';
    activeCommitments = [];
    locationQ = '';
    searchQ = '';
    sortBy = 'recommended';
    minInvest = null;
    maxInvest = null;
    currentPage = 1;

    if (els.search) els.search.value = '';
    if (els.sort) els.sort.value = 'recommended';
    if (els.postcode) els.postcode.value = '';
    if (els.category) els.category.value = '';
    if (els.minInvest) els.minInvest.value = '';
    if (els.maxInvest) els.maxInvest.value = '';

    syncTypeChipUi();
    syncInvestPills();
    syncCommitmentChecks();
    applyFilters();
  }

  function premiumSpotlightCard(item) {
    var href = detailHref(item);
    var thumb = item.thumb || { emoji: '✦', gradient: 'linear-gradient(135deg,#fdf6e3,#f5e0a0)' };
    var typeLabels = catalog ? catalog.TYPE_LABELS : {};
    var typeLabel = typeLabels[item.type] || item.type || 'Opportunity';
    var mediaInner = item.imageUrl
      ? '<img class="premium-card-img' +
        (item.logoUrl ? ' is-logo-cover' : '') +
        '" src="' +
        escapeHtml(item.imageUrl) +
        '" alt="" loading="lazy" decoding="async" />'
      : '<span class="opp-premium-thumb-emoji" aria-hidden="true">' + thumb.emoji + '</span>';

    return (
      '<article class="premium-card opp-premium-card" data-id="' +
      escapeHtml(item.id) +
      '"><a class="premium-card-link" href="' +
      escapeHtml(href) +
      '"><div class="premium-card-media" aria-hidden="true"><div class="premium-card-bg" style="background:' +
      escapeHtml(thumb.gradient) +
      '">' +
      mediaInner +
      '</div><div class="premium-card-overlay"></div></div><div class="premium-card-top"><span class="premium-badge">Premium</span><span class="premium-price">' +
      escapeHtml(investmentLabel(item)) +
      '</span></div><div class="premium-card-body"><h3 class="premium-card-title">' +
      escapeHtml(item.title) +
      '</h3><div class="premium-card-meta"><p class="premium-meta-row"><span>' +
      escapeHtml(typeLabel) +
      ' · ' +
      escapeHtml(item.locationLabel || 'UK') +
      '</span></p><p class="premium-meta-row"><span>' +
      escapeHtml(item.host || 'Provider') +
      '</span></p></div></div></a></article>'
    );
  }

  function getSpotlightFeatured() {
    if (!spotlightFeaturedOrder) {
      spotlightFeaturedOrder = shuffleList(
        allListings
          .filter(function (item) {
            return item.featured;
          })
          .slice(0, SPOTLIGHT_MAX)
      );
    }
    return spotlightFeaturedOrder;
  }

  function resetSpotlightOrder() {
    spotlightFeaturedOrder = null;
  }

  function renderSpotlight() {
    if (!els.spotlightTrack) return;
    var featured = getSpotlightFeatured().filter(matchesFilter);
    if (!featured.length) {
      featured = getSpotlightFeatured();
    }
    if (!featured.length) {
      els.spotlightTrack.innerHTML =
        '<p class="spotlight-empty">No featured opportunities yet.</p>';
      return;
    }
    var cardsHtml = featured.map(premiumSpotlightCard).join('');
    var sc = window.HubSpotlightCarousel;
    if (sc) {
      sc.applyLoopLayout(els.spotlightTrack, els.spotlightSection, featured.length, '.opp-premium-card', cardsHtml);
    } else {
      els.spotlightTrack.innerHTML = cardsHtml;
    }
  }

  function bindSpotlightCarousel() {
    if (spotlightCarouselBound) return;
    spotlightCarouselBound = true;
    var prev = document.getElementById('spotlight-prev');
    var next = document.getElementById('spotlight-next');
    var track = els.spotlightTrack;
    if (prev && track) {
      prev.addEventListener('click', function () {
        track.scrollBy({ left: -280, behavior: 'smooth' });
      });
    }
    if (next && track) {
      next.addEventListener('click', function () {
        track.scrollBy({ left: 280, behavior: 'smooth' });
      });
    }
  }

  function bindFilters() {
    buildTypeChips();

    document.querySelectorAll('input[data-invest-tier]').forEach(function (input) {
      input.addEventListener('change', function () {
        if (!input.checked) return;
        activeInvestTier = input.getAttribute('data-invest-tier') || 'all';
        syncInvestPills();
        applyFilters();
      });
    });

    document.querySelectorAll('[data-commitment]').forEach(function (input) {
      input.addEventListener('change', function () {
        var id = input.getAttribute('data-commitment');
        var idx = activeCommitments.indexOf(id);
        if (input.checked && idx === -1) activeCommitments.push(id);
        if (!input.checked && idx !== -1) activeCommitments.splice(idx, 1);
        applyFilters();
      });
    });

    if (els.category) {
      els.category.addEventListener('change', applyFilters);
    }
    if (els.sort) {
      els.sort.addEventListener('change', applyFilters);
    }
    if (els.postcode) {
      els.postcode.addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(applyFilters, SEARCH_DEBOUNCE_MS);
      });
    }
    if (els.search) {
      els.search.addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(applyFilters, SEARCH_DEBOUNCE_MS);
      });
    }
    [els.minInvest, els.maxInvest].forEach(function (input) {
      if (!input) return;
      input.addEventListener('change', applyFilters);
    });

    if (els.moreToggle && els.morePanel) {
      els.moreToggle.addEventListener('click', function () {
        var open = els.morePanel.hasAttribute('hidden');
        if (open) els.morePanel.removeAttribute('hidden');
        else els.morePanel.setAttribute('hidden', '');
        els.moreToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }

    if (els.clearBar) els.clearBar.addEventListener('click', resetFilters);
    if (els.clearResults) els.clearResults.addEventListener('click', resetFilters);

    if (els.listings) {
      els.listings.addEventListener('click', function (e) {
        var btn = e.target.closest('.page-btn');
        if (!btn || btn.disabled) return;
        var p = parseInt(btn.getAttribute('data-page'), 10);
        if (!p || p === currentPage) return;
        currentPage = p;
        renderListings();
        var block = document.getElementById('listings-view');
        if (block) block.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  function bindFavClicks() {
    if (document.body.dataset.testingBoFavBound) return;
    document.body.dataset.testingBoFavBound = '1';
    document.addEventListener('click', function (e) {
      var fav = e.target.closest('.opp-fav-btn');
      if (!fav || !document.body.classList.contains('testing-bo-page')) return;
      e.preventDefault();
      e.stopPropagation();
      if (!saves) return;
      var id = fav.getAttribute('data-opp-id');
      saves.toggle(id);
      fav.classList.toggle('is-active', saves.isSaved(id));
      fav.setAttribute('aria-pressed', saves.isSaved(id) ? 'true' : 'false');
      fav.setAttribute(
        'aria-label',
        saves.isSaved(id) ? 'Remove from saved' : 'Save opportunity'
      );
    });
  }

  function bootListings(listings) {
    allListings = listings || [];
    resetSpotlightOrder();
    syncTypeChipUi();
    syncInvestPills();
    syncCommitmentChecks();
    renderSpotlight();
    renderListings();
  }

  function bindHubertStrip() {
    var strip = document.getElementById('opp-hubert-strip');
    if (!strip || strip.dataset.bound === '1') return;
    strip.dataset.bound = '1';
    strip.querySelectorAll('[data-hubert-prompt]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var prompt = chip.getAttribute('data-hubert-prompt') || '';
        if (window.HubertWidget && window.HubertWidget.openWithPrompt) {
          window.HubertWidget.openWithPrompt(prompt);
        } else if (window.HubertChat && window.HubertChat.openWithPrompt) {
          window.HubertChat.openWithPrompt(prompt);
        }
      });
    });
  }

  function init() {
    if (!document.body.classList.contains('testing-bo-page')) return;
    cacheEls();
    bindFilters();
    bindSpotlightCarousel();
    bindFavClicks();
    bindHubertStrip();
    if (window.HubOpportunityInvestment) {
      window.HubOpportunityInvestment.bindCardPopovers(function (id) {
        for (var i = 0; i < allListings.length; i++) {
          if (String(allListings[i].id) === String(id)) return allListings[i];
        }
        return null;
      });
    }
    allListings = catalog ? catalog.loadCatalog() : [];
    bootListings(allListings);

    if (catalog && catalog.loadCatalogAsync) {
      catalog.loadCatalogAsync().then(function (merged) {
        if (saves) saves.refreshButtons(document);
        if (!merged || !merged.length) return;
        bootListings(merged);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
