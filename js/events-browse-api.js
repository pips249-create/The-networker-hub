/**
 * Server-paginated event browse — fetches pages from /api/hub-listings.
 */
(function () {
  var API_PATH = '/api/hub-listings';
  var DEBOUNCE_MS = 320;
  var debounceTimer = null;
  var fetchToken = 0;
  var lastTypeCounts = null;
  var lastPinsSignature = '';
  var lastFilterSignature = '';

  function browseFilterSignature(params) {
    var copy = Object.assign({}, params || {});
    delete copy.page;
    delete copy.limit;
    delete copy.meta;
    delete copy.mode;
    delete copy.offset;
    return JSON.stringify(copy);
  }

  function isMapViewOpen() {
    var mapBtn = document.getElementById('map-view-btn');
    return !!(mapBtn && mapBtn.getAttribute('aria-pressed') === 'true');
  }

  function el(id) {
    return document.getElementById(id);
  }

  function gatherParams(page) {
    var searchInput = el('search');
    var postcodeInput = el('postcode');
    var sortSelect = el('sort');
    var checkInPerson = el('check-inperson');
    var checkOnline = el('check-online');
    var checkFreeOnly = el('filter-free-only');
    var priceMinInput = el('price-min-input');
    var priceMaxInput = el('price-max-input');
    var locationRadius = el('location-radius');

    var params = {
      page: page || 1,
      limit: window.hubBrowsePageSize || 12,
      meta: (page || 1) > 1 ? '0' : '1',
      sort: (sortSelect && sortSelect.value) || 'recommended',
      q: searchInput ? searchInput.value.trim() : '',
      inPerson: checkInPerson && checkInPerson.checked ? '1' : '0',
      online: checkOnline && checkOnline.checked ? '1' : '0',
      free: checkFreeOnly && checkFreeOnly.checked ? '1' : '0',
      location: postcodeInput ? postcodeInput.value.trim() : '',
    };

    if (priceMinInput && String(priceMinInput.value).trim() !== '') {
      params.priceMin = String(priceMinInput.value).trim();
    }
    if (priceMaxInput && String(priceMaxInput.value).trim() !== '') {
      params.priceMax = String(priceMaxInput.value).trim();
    }

    if (window.hubIsNearMeActive && window.hubIsNearMeActive()) {
      if (window.hubUserCoords && window.hubUserCoords.length === 2) {
        params.lat = String(window.hubUserCoords[0]);
        params.lng = String(window.hubUserCoords[1]);
        params.radius = String(
          window.hubLocationRadiusMiles ? window.hubLocationRadiusMiles() : 25
        );
      }
    } else if (params.location && window.hubAllowedOutcodesForQuery) {
      var outcodes = window.hubAllowedOutcodesForQuery(params.location);
      if (outcodes && outcodes.length) {
        params.outcodes = outcodes.join(',');
      }
    }

    var typeTabs =
      window.hubGetActiveTypeTabs && window.hubGetActiveTypeTabs().length
        ? window.hubGetActiveTypeTabs()
        : window.hubBrowseActiveTypeTabs && window.hubBrowseActiveTypeTabs.length
          ? window.hubBrowseActiveTypeTabs
          : [];
    if (typeTabs.length) {
      params.types = typeTabs.join(',');
    }

    if (window.hubBrowseDateFrom) params.dateFrom = window.hubBrowseDateFrom;
    if (window.hubBrowseDateTo) params.dateTo = window.hubBrowseDateTo;

    return params;
  }

  function buildUrl(params) {
    var q = new URLSearchParams();
    Object.keys(params).forEach(function (key) {
      var val = params[key];
      if (val == null || val === '') return;
      q.set(key, String(val));
    });
    return API_PATH + '?' + q.toString();
  }

  function applyBrowsePayload(data, page) {
    window.hubBrowseEvents = (data.events || []).slice();
    window.hubBrowseFeatured = (data.featured || []).slice();
    window.hubBrowseTotal = data.pagination ? Number(data.pagination.total) || 0 : window.hubBrowseEvents.length;
    window.hubBrowsePagination = data.pagination || null;
    if (data.meta && data.meta.typeCounts) {
      lastTypeCounts = data.meta.typeCounts;
      window.hubBrowseTypeCounts = lastTypeCounts;
    } else if (lastTypeCounts) {
      window.hubBrowseTypeCounts = lastTypeCounts;
    } else {
      window.hubBrowseTypeCounts = null;
    }
    if (typeof page === 'number') {
      window.hubBrowseCurrentPage = page;
    }
  }

  function fetchPins(params) {
    var pinParams = Object.assign({}, params, { mode: 'pins', meta: '0' });
    delete pinParams.page;
    return fetch(buildUrl(pinParams), { credentials: 'same-origin' })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        window.hubBrowsePins = (data.events || []).slice();
        lastPinsSignature = browseFilterSignature(params);
        return window.hubBrowsePins;
      })
      .catch(function () {
        window.hubBrowsePins = [];
        lastPinsSignature = browseFilterSignature(params);
        return [];
      });
  }

  function fetchPinsIfNeeded(params) {
    var signature = browseFilterSignature(params);
    if (
      signature === lastPinsSignature &&
      Array.isArray(window.hubBrowsePins) &&
      window.hubBrowsePins.length
    ) {
      return Promise.resolve(window.hubBrowsePins);
    }
    return fetchPins(params);
  }

  function onBrowseFetchError(err) {
    console.error('Browse fetch failed', err);
    var status = document.getElementById('load-status');
    if (status) {
      status.textContent = 'Could not refresh results. Try again or clear filters.';
      status.hidden = false;
      status.classList.add('is-error');
    }
  }

  function hubBrowseFetch(page, options) {
    options = options || {};
    var token = ++fetchToken;
    var params = gatherParams(page);
    var url = buildUrl(params);
    var filterSignature = browseFilterSignature(params);

    if (filterSignature !== lastFilterSignature) {
      lastFilterSignature = filterSignature;
      lastTypeCounts = null;
      if (window.hubBrowseInvalidatePins) window.hubBrowseInvalidatePins();
    }

    return fetch(url, { credentials: 'same-origin', cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (token !== fetchToken) return data;
        if (!data.configured) throw new Error('not_configured');
        if (data.error) throw new Error(data.message || data.error);
        applyBrowsePayload(data, page);
        var status = document.getElementById('load-status');
        if (status && status.classList.contains('is-error')) {
          status.textContent = '';
          status.hidden = true;
          status.classList.remove('is-error');
        }
        if (!options.skipPins && isMapViewOpen()) {
          fetchPinsIfNeeded(params).then(function () {
            if (window.hubRefreshMap) {
              window.hubRefreshMap(window.hubBrowsePins || []);
            }
          });
        }
        if (window.hubRefreshListings) window.hubRefreshListings();
        if (window.hubUpdateEventTypeChipCounts) window.hubUpdateEventTypeChipCounts();
        return data;
      })
      .catch(function (err) {
        if (token === fetchToken) onBrowseFetchError(err);
        throw err;
      });
  }

  function hubBrowseFetchDebounced(page) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      debounceTimer = null;
      hubBrowseFetch(page || 1).catch(function () {
        /* surfaced in hubBrowseFetch */
      });
    }, DEBOUNCE_MS);
  }

  function hubBrowseFetchNow(page) {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    return hubBrowseFetch(page || 1);
  }

  function hubBrowseFetchPins() {
    var params = gatherParams(1);
    return fetchPinsIfNeeded(params);
  }

  window.hubBrowseInvalidatePins = function () {
    lastPinsSignature = '';
    window.hubBrowsePins = [];
  };

  window.hubServerBrowse = true;
  window.hubBrowseFetch = hubBrowseFetch;
  window.hubBrowseFetchDebounced = hubBrowseFetchDebounced;
  window.hubBrowseFetchNow = hubBrowseFetchNow;
  window.hubBrowseFetchPins = hubBrowseFetchPins;
  window.hubBrowseCurrentPage = 1;
})();
