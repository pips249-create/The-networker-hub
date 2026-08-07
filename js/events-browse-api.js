/**
 * Server-paginated event browse — fetches pages from /api/hub-listings.
 */
(function () {
  var API_PATH = '/api/hub-listings';
  var ANALYTICS_PATH = '/api/browse-analytics';
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
    var checkFiveStarsOnly = el('filter-five-stars-only');
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
      fiveStars: checkFiveStarsOnly && checkFiveStarsOnly.checked ? '1' : '0',
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
          window.hubLocationRadiusMiles ? window.hubLocationRadiusMiles() : 15
        );
      }
    } else if (params.location) {
      params.radius = String(
        window.hubLocationRadiusMiles ? window.hubLocationRadiusMiles() : 15
      );
      var filterCoords = window.hubLocationFilterCoords;
      if (filterCoords && filterCoords.length === 2) {
        params.lat = String(filterCoords[0]);
        params.lng = String(filterCoords[1]);
      } else if (
        window.hubPrefersGeoRadiusForLocation &&
        window.hubPrefersGeoRadiusForLocation(params.location)
      ) {
        /* Full postcode: server geocodes when lat/lng are missing. */
      } else if (window.hubAllowedOutcodesForQuery) {
        /* Geocode pending/failed — keep sector match so results still filter. */
        var outcodes = window.hubAllowedOutcodesForQuery(params.location);
        if (outcodes && outcodes.length) {
          params.outcodes = outcodes.join(',');
        }
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

  function dedupeEventsById(list) {
    var seen = {};
    return (list || []).filter(function (ev) {
      var id = ev && ev.id != null ? String(ev.id) : '';
      if (!id || seen[id]) return false;
      seen[id] = true;
      return true;
    });
  }

  function applyBrowsePayload(data, page) {
    window.hubBrowseEvents = dedupeEventsById(data.events || []);
    // Page 2+ requests set meta=0 and omit a real featured payload (empty array).
    // Keep the existing spotlight cards instead of wiping them on pagination.
    var pageNum = typeof page === 'number' ? page : Number(page) || 1;
    var shouldReplaceFeatured =
      pageNum <= 1 ||
      (data.meta && Object.prototype.hasOwnProperty.call(data, 'featured'));
    if (shouldReplaceFeatured) {
      var nextFeatured = dedupeEventsById(data.featured || []);
      var prevFeatured = window.hubBrowseFeatured || [];
      var featuredChanged =
        nextFeatured.length !== prevFeatured.length ||
        nextFeatured.some(function (ev, i) {
          return String((ev && ev.id) || '') !== String((prevFeatured[i] && prevFeatured[i].id) || '');
        });
      window.hubBrowseFeatured = nextFeatured;
      if (featuredChanged && typeof window.hubResetSpotlightOrder === 'function') {
        window.hubResetSpotlightOrder();
      }
    }
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
    if (data.meta && typeof data.meta.spotlightHasActiveFeatured === 'boolean') {
      window.hubBrowseHasActiveFeatured = data.meta.spotlightHasActiveFeatured;
    }
    if (data.meta && data.meta.spotlightSlots) {
      window.hubBrowseSpotlightSlots = data.meta.spotlightSlots;
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
    window.hubBrowseEvents = [];
    window.hubBrowseFeatured = [];
    window.hubBrowseTotal = 0;
    window.hubBrowsePagination = null;
    if (window.hubRefreshListings) window.hubRefreshListings();
    var status = document.getElementById('load-status');
    if (status) {
      var msg = err && err.message ? String(err.message) : '';
      if (/403|site_private|private preview/i.test(msg)) {
        status.textContent =
          'Preview access required. Open /site-access, enter the preview password, then return to Events.';
      } else {
        status.textContent = 'Could not refresh results. Try again or clear filters.';
      }
      status.hidden = false;
      status.classList.add('is-error');
    }
  }

  function hasAnalyticsConsent() {
    if (window.HubBrowseAnalytics && typeof window.HubBrowseAnalytics.hasConsent === 'function') {
      return window.HubBrowseAnalytics.hasConsent();
    }
    if (window.HubCookieConsent && typeof window.HubCookieConsent.hasAnalyticsConsent === 'function') {
      return window.HubCookieConsent.hasAnalyticsConsent();
    }
    var consent = window.HubCookieConsent && window.HubCookieConsent.getConsent
      ? window.HubCookieConsent.getConsent()
      : null;
    return !!(consent && consent.analytics);
  }

  function browseHasDemandSignal(params, resultCount) {
    if (params.q) return true;
    if (params.location) return true;
    if (params.types) return true;
    if (params.inPerson === '1' || params.online === '1') return true;
    if (params.free === '1' || params.fiveStars === '1') return true;
    if (params.dateFrom || params.dateTo) return true;
    if (params.priceMin || params.priceMax) return true;
    return false;
  }

  function logBrowseSearch(params, resultCount) {
    try {
      if (!hasAnalyticsConsent()) return;
      if (Number(params.page || 1) > 1) return;
      if (!browseHasDemandSignal(params, resultCount)) return;

      var regional = window.hubRegionalLanding || null;
      var payload = {
        source: 'events_browse',
        q: params.q || '',
        location: params.location || '',
        regionSlug: (regional && regional.slug) || '',
        types: params.types || '',
        inPerson: params.inPerson || '0',
        online: params.online || '0',
        free: params.free || '0',
        fiveStars: params.fiveStars || '0',
        dateFrom: params.dateFrom || '',
        dateTo: params.dateTo || '',
        priceMin: params.priceMin || '',
        priceMax: params.priceMax || '',
        sort: params.sort || '',
        resultCount: Number(resultCount) || 0,
      };

      if (window.HubBrowseAnalytics && typeof window.HubBrowseAnalytics.logSearch === 'function') {
        window.HubBrowseAnalytics.logSearch(payload);
        return;
      }

      fetch(ANALYTICS_PATH, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ action: 'record_search' }, payload)),
        keepalive: true,
      }).catch(function () {});
    } catch (e) {
      /* ignore analytics failures */
    }
  }

  function setBrowseResultsLoading(on) {
    var listings = el('event-listings');
    var results = el('events-results');
    var sortSelect = el('sort');
    document.body.classList.toggle('browse-results-loading', !!on);
    if (listings) {
      listings.classList.toggle('is-updating', !!on);
      listings.setAttribute('aria-busy', on ? 'true' : 'false');
    }
    if (results) {
      results.classList.toggle('is-updating', !!on);
    }
    if (sortSelect) {
      sortSelect.setAttribute('aria-busy', on ? 'true' : 'false');
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
      if (isMapViewOpen() && window.hubRefreshMap) {
        window.hubRefreshMap([]);
      }
    }

    setBrowseResultsLoading(true);

    return fetch(url, { credentials: 'same-origin', cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) {
          return res
            .json()
            .catch(function () {
              return null;
            })
            .then(function (body) {
              if (body && body.error === 'site_private') {
                throw new Error(body.message || 'site_private');
              }
              throw new Error('HTTP ' + res.status);
            });
        }
        return res.json();
      })
      .then(function (data) {
        if (token !== fetchToken) return data;
        if (!data.configured) throw new Error('not_configured');
        if (data.error) throw new Error(data.message || data.error);
        applyBrowsePayload(data, page);
        logBrowseSearch(params, window.hubBrowseTotal || 0);
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
        if (window.hubSyncMobileFilterToggle) window.hubSyncMobileFilterToggle();
        return data;
      })
      .catch(function (err) {
        if (token === fetchToken) onBrowseFetchError(err);
        throw err;
      })
      .finally(function () {
        if (token === fetchToken) setBrowseResultsLoading(false);
      });
  }

  function hubBrowseFetchDebounced(page) {
    setBrowseResultsLoading(true);
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
