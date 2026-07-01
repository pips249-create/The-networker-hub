/**
 * Server-paginated event browse — fetches pages from /api/hub-listings.
 */
(function () {
  var API_PATH = '/api/hub-listings';
  var DEBOUNCE_MS = 320;
  var debounceTimer = null;
  var fetchToken = 0;

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
    var priceMax = el('price-max');
    var locationRadius = el('location-radius');

    var params = {
      page: page || 1,
      limit: window.hubBrowsePageSize || 12,
      meta: '1',
      sort: (sortSelect && sortSelect.value) || 'recommended',
      q: searchInput ? searchInput.value.trim() : '',
      inPerson: checkInPerson && checkInPerson.checked ? '1' : '0',
      online: checkOnline && checkOnline.checked ? '1' : '0',
      free: checkFreeOnly && checkFreeOnly.checked ? '1' : '0',
      location: postcodeInput ? postcodeInput.value.trim() : '',
    };

    if (priceMax && Number(priceMax.value) < Number(priceMax.max)) {
      params.priceMax = String(priceMax.value);
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

    if (window.hubBrowseActiveTypeTabs && window.hubBrowseActiveTypeTabs.length) {
      params.type = window.hubBrowseActiveTypeTabs.join(',');
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
    window.hubBrowseTypeCounts =
      data.meta && data.meta.typeCounts ? data.meta.typeCounts : null;
    window.hubBrowsePricePeak =
      data.meta && data.meta.pricePeak != null ? Number(data.meta.pricePeak) : null;
    window.hubAllEvents = window.hubBrowseEvents.slice();
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
        return window.hubBrowsePins;
      })
      .catch(function () {
        window.hubBrowsePins = [];
        return [];
      });
  }

  function hubBrowseFetch(page, options) {
    options = options || {};
    var token = ++fetchToken;
    var params = gatherParams(page);
    var url = buildUrl(params);

    return fetch(url, { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (token !== fetchToken) return data;
        if (!data.configured) throw new Error('not_configured');
        if (data.error) throw new Error(data.message || data.error);
        applyBrowsePayload(data, page);
        if (!options.skipPins) {
          fetchPins(params).then(function () {
            var mapBtn = document.getElementById('map-view-btn');
            if (
              window.hubRefreshMap &&
              mapBtn &&
              mapBtn.getAttribute('aria-pressed') === 'true'
            ) {
              window.hubRefreshMap(window.hubBrowsePins || []);
            }
          });
        }
        if (window.hubRefreshListings) window.hubRefreshListings();
        if (window.hubUpdateEventTypeChipCounts) window.hubUpdateEventTypeChipCounts();
        if (window.hubInitPriceFilter) window.hubInitPriceFilter();
        return data;
      });
  }

  function hubBrowseFetchDebounced(page) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      debounceTimer = null;
      hubBrowseFetch(page || 1).catch(function (err) {
        console.error('Browse fetch failed', err);
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
    return fetchPins(params);
  }

  window.hubServerBrowse = true;
  window.hubBrowseFetch = hubBrowseFetch;
  window.hubBrowseFetchDebounced = hubBrowseFetchDebounced;
  window.hubBrowseFetchNow = hubBrowseFetchNow;
  window.hubBrowseFetchPins = hubBrowseFetchPins;
  window.hubBrowseCurrentPage = 1;
})();
