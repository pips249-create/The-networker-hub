/**
 * Leaflet map for business opportunities — geocodes location labels via postcodes.io.
 */
(function () {
  var catalog = window.HubOpportunitiesCatalog;

  var mapWrap = document.getElementById('opp-map-wrap');
  var mapPanel = document.getElementById('opp-map-panel');
  var mapHint = document.getElementById('opp-map-hint');
  var mapSidebar = document.getElementById('opp-map-sidebar');
  var mapSidebarList = document.getElementById('opp-map-sidebar-list');
  var mapSidebarCount = document.getElementById('opp-map-sidebar-count');
  var mapSidebarSub = document.getElementById('opp-map-sidebar-sub');
  var mapSidebarCountBtn = document.getElementById('opp-map-sidebar-count-btn');
  var mapSidebarCountHint = document.getElementById('opp-map-sidebar-count-hint');
  var mapListToggle = document.getElementById('opp-map-list-toggle');
  var mapListToggleLabel = document.getElementById('opp-map-list-toggle-label');
  var mapSidebarFoot = document.getElementById('opp-map-sidebar-foot');
  var mapSidebarLoadMore = document.getElementById('opp-map-sidebar-load-more');
  var listingsMount = document.getElementById('opp-listings-mount');
  var featuredBanner = document.getElementById('opp-featured-banner');
  var viewGridBtn = document.getElementById('opp-view-grid');
  var viewListBtn = document.getElementById('opp-view-list');
  var viewMapBtn = document.getElementById('opp-view-map');

  var map = null;
  var markerLayer = null;
  var mapReady = false;
  var isMapView = false;
  var renderToken = 0;
  var markersById = Object.create(null);
  var activeSidebarId = null;
  var lastFilteredList = [];
  var sidebarItemsCache = [];
  var sidebarVisibleCount = 50;
  var sidebarMetaTotal = 0;
  var SIDEBAR_PAGE = 50;
  var lastLayoutMobile = null;

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function isMappableLocation(item) {
    var loc = String((item && item.locationLabel) || '').toLowerCase();
    if (!loc || loc === 'uk') return false;
    if (/remote|online|uk-wide|nationwide|anywhere|work from home|wfh/.test(loc)) return false;
    return true;
  }

  function coordsForItem(item) {
    if (!isMappableLocation(item)) return null;
    if (item.mapLat != null && item.mapLng != null) {
      return [item.mapLat, item.mapLng];
    }
    return null;
  }

  function detailHref(item) {
    if (catalog && catalog.detailHref) return catalog.detailHref(item);
    return 'opportunity.html?id=' + encodeURIComponent(item.id);
  }

  function typeLabel(item) {
    var labels = catalog ? catalog.TYPE_LABELS : {};
    return labels[item.type] || item.type || 'Opportunity';
  }

  function investmentLabel(item) {
    if (!catalog || !catalog.cardDisplayMeta) return '';
    var meta = catalog.cardDisplayMeta(item);
    for (var i = 0; i < meta.length; i++) {
      if (/invest/i.test(meta[i].key)) return meta[i].val || '';
    }
    return '';
  }

  function isMobileMapLayout() {
    return window.matchMedia('(max-width: 900px)').matches;
  }

  function mobilePanelHeightPx() {
    var vh = window.innerHeight || document.documentElement.clientHeight || 600;
    return Math.min(Math.round(vh * 0.52), 560);
  }

  function clearPanelInlineSize() {
    if (!mapPanel) return;
    mapPanel.style.height = '';
    mapPanel.style.minHeight = '';
  }

  function ensurePanelSize() {
    if (!mapPanel || !mapWrap || mapWrap.hidden) return;
    if (mapPanel.offsetHeight > 0 && mapPanel.offsetWidth > 0) return;
    if (isMobileMapLayout()) {
      mapPanel.style.height = mobilePanelHeightPx() + 'px';
      mapPanel.style.minHeight = '300px';
    } else {
      mapPanel.style.height = '420px';
      mapPanel.style.minHeight = '420px';
    }
  }

  function panelHasSize() {
    return !!(mapPanel && mapPanel.offsetHeight > 0 && mapPanel.offsetWidth > 0);
  }

  function setMapHint(message) {
    if (!mapHint) return;
    if (message) {
      mapHint.textContent = message;
      mapHint.hidden = false;
    } else {
      mapHint.textContent = '';
      mapHint.hidden = true;
    }
  }

  function invalidateMapSize(attempt) {
    if (!map) return;
    map.invalidateSize(true);
    var size = map.getSize();
    if ((size.x === 0 || size.y === 0) && attempt < 8) {
      setTimeout(function () {
        invalidateMapSize(attempt + 1);
      }, 80 * (attempt + 1));
    }
  }

  function whenPanelReady(fn) {
    var attempt = 0;
    (function tick() {
      if (!isMapView) return;
      ensurePanelSize();
      if (panelHasSize() || attempt >= 24) {
        fn();
        return;
      }
      attempt++;
      setTimeout(tick, 50);
    })();
  }

  function initMap() {
    if (mapReady || !mapPanel || typeof L === 'undefined') return;
    ensurePanelSize();
    var touchDevice =
      window.matchMedia('(max-width: 900px)').matches ||
      (typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: coarse)').matches);
    map = L.map(mapPanel, {
      scrollWheelZoom: !touchDevice,
    }).setView([54.5, -2.5], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);
    try {
      markerLayer =
        typeof L.markerClusterGroup === 'function'
          ? L.markerClusterGroup({
              maxClusterRadius: 52,
              spiderfyOnMaxZoom: true,
              showCoverageOnHover: false,
              zoomToBoundsOnClick: true,
            })
          : L.layerGroup();
    } catch (err) {
      markerLayer = L.layerGroup();
    }
    map.addLayer(markerLayer);
    mapReady = true;
  }

  function fitMapToCoords(coordsList) {
    if (!map || !coordsList.length) return;
    if (coordsList.length === 1) {
      map.setView(coordsList[0], 13);
    } else {
      map.fitBounds(L.latLngBounds(coordsList), { padding: [48, 48], maxZoom: 13 });
    }
  }

  function fitMapToMarkers(coordsList) {
    if (!map) return;
    if (markerLayer && typeof markerLayer.getBounds === 'function') {
      try {
        var bounds = markerLayer.getBounds();
        if (bounds && bounds.isValid && bounds.isValid()) {
          map.fitBounds(bounds, { padding: [48, 48], maxZoom: 13 });
          return;
        }
      } catch (err) {
        /* fall through */
      }
    }
    fitMapToCoords(coordsList);
  }

  function scheduleMapFit(coordsList) {
    if (!map || !coordsList || !coordsList.length) return;
    function doFit() {
      if (!map || !isMapView) return;
      invalidateMapSize(0);
      fitMapToMarkers(coordsList);
    }
    requestAnimationFrame(doFit);
    setTimeout(doFit, 150);
  }

  function markerIcon() {
    return L.divIcon({
      className: 'hub-map-pin hub-map-pin--opportunity',
      html: '<span class="hub-map-pin-dot"></span>',
      iconSize: [20, 26],
      iconAnchor: [10, 26],
      popupAnchor: [0, -22],
    });
  }

  function popupHtml(item) {
    var invest = investmentLabel(item);
    var premium = item.featured ? '<span class="opp-map-card-premium">Premium</span>' : '';
    return (
      '<div class="opp-map-card">' +
      '<div class="opp-map-card-top">' +
      premium +
      '<span class="opp-map-card-type">' +
      escapeHtml(typeLabel(item)) +
      '</span>' +
      (invest
        ? '<span class="opp-map-card-invest">' + escapeHtml(invest) + '</span>'
        : '') +
      '</div>' +
      '<h3 class="opp-map-card-title">' +
      escapeHtml(item.title) +
      '</h3>' +
      '<p class="opp-map-card-host">' +
      escapeHtml(item.host || '') +
      '</p>' +
      '<p class="opp-map-card-location">' +
      escapeHtml(item.locationLabel || '') +
      '</p>' +
      '<a class="opp-map-card-cta" href="' +
      escapeHtml(detailHref(item)) +
      '">View opportunity</a>' +
      '</div>'
    );
  }

  function highlightSidebarItem(oppId) {
    activeSidebarId = oppId || null;
    if (!mapSidebarList) return;
    mapSidebarList.querySelectorAll('.opp-map-sidebar-item').forEach(function (item) {
      item.classList.toggle('is-active', item.getAttribute('data-opp-id') === oppId);
    });
  }

  function focusMarker(oppId) {
    var marker = markersById[oppId];
    if (!marker || !map) return;

    function openFocused() {
      map.setView(marker.getLatLng(), Math.max(map.getZoom(), 13));
      marker.openPopup();
      highlightSidebarItem(oppId);
    }

    if (markerLayer && typeof markerLayer.zoomToShowLayer === 'function') {
      markerLayer.zoomToShowLayer(marker, openFocused);
    } else {
      openFocused();
    }
  }

  function addMarker(item, coords) {
    var popupMax = Math.min(280, Math.max(220, (window.innerWidth || 320) - 48));
    var marker = L.marker(coords, { icon: markerIcon() }).bindPopup(popupHtml(item), {
      className: 'opp-map-popup',
      maxWidth: popupMax,
      minWidth: Math.min(220, popupMax),
    });
    marker.on('popupopen', function () {
      highlightSidebarItem(item.id);
    });
    marker.on('popupclose', function () {
      if (activeSidebarId === item.id) highlightSidebarItem(null);
    });
    markersById[item.id] = marker;
    markerLayer.addLayer(marker);
  }

  function sidebarItemLabel(item) {
    var parts = [item.title, item.locationLabel || ''];
    var invest = investmentLabel(item);
    if (invest) parts.push(invest);
    return parts.join(', ');
  }

  function sidebarItemHtml(item) {
    var invest = investmentLabel(item);
    var meta = [item.locationLabel || 'UK'];
    if (invest) meta.push(invest);
    return (
      '<li class="opp-map-sidebar-item" data-opp-id="' +
      escapeHtml(item.id) +
      '">' +
      '<button type="button" class="opp-map-sidebar-item-btn" aria-label="' +
      escapeHtml(sidebarItemLabel(item)) +
      '">' +
      '<span class="opp-map-sidebar-item-title">' +
      escapeHtml(item.title) +
      '</span>' +
      '<span class="opp-map-sidebar-item-meta">' +
      escapeHtml(meta.join(' · ')) +
      '</span>' +
      (invest
        ? '<span class="opp-map-sidebar-item-invest">' + escapeHtml(invest) + '</span>'
        : '') +
      '</button></li>'
    );
  }

  function updateSidebarLoadMore(onMap) {
    if (!mapSidebarFoot || !mapSidebarLoadMore) return;
    var remaining = onMap - sidebarVisibleCount;
    if (remaining > 0) {
      mapSidebarFoot.hidden = false;
      mapSidebarLoadMore.textContent =
        'Load more (' + Math.min(SIDEBAR_PAGE, remaining) + ' of ' + remaining + ' remaining)';
    } else {
      mapSidebarFoot.hidden = true;
    }
  }

  function paintSidebarList(onMap) {
    if (!mapSidebarList) return;
    var slice = sidebarItemsCache.slice(0, sidebarVisibleCount);
    mapSidebarList.innerHTML = slice.map(sidebarItemHtml).join('');
    updateSidebarLoadMore(onMap);
    if (activeSidebarId && !markersById[activeSidebarId]) {
      highlightSidebarItem(null);
    }
  }

  function updateSidebarSub(onMap, total) {
    if (!mapSidebarSub) return;
    if (!onMap) {
      mapSidebarSub.textContent = total
        ? 'No mappable locations in your current filters. Remote and UK-wide listings are not shown on the map.'
        : 'No opportunities to show yet.';
      return;
    }
    if (onMap < total) {
      mapSidebarSub.textContent =
        onMap + ' with a location on the map · ' + (total - onMap) + ' remote or UK-wide hidden';
    } else {
      mapSidebarSub.textContent = '';
    }
  }

  function renderSidebar(allList, mappableList) {
    if (!mapSidebarList || !mapSidebarCount) return;

    var total = (allList || []).length;
    var onMap = (mappableList || []).length;
    sidebarVisibleCount = SIDEBAR_PAGE;
    sidebarMetaTotal = total;
    mapSidebarCount.textContent = String(onMap);

    if (!onMap) {
      sidebarItemsCache = [];
      updateSidebarSub(0, total);
      mapSidebarList.innerHTML = '';
      if (mapSidebarFoot) mapSidebarFoot.hidden = true;
      return;
    }

    sidebarItemsCache = mappableList.slice();
    updateSidebarSub(onMap, total);
    paintSidebarList(onMap);
  }

  function enrichOpportunityCoords(items) {
    var pending = (items || []).filter(function (item) {
      return isMappableLocation(item) && !coordsForItem(item);
    });
    if (!pending.length || !window.hubGeocodeLocationQuery) return Promise.resolve();

    return pending.reduce(function (chain, item) {
      return chain.then(function () {
        var query = String(item.locationLabel || '').trim();
        if (!query) return null;
        return window.hubGeocodeLocationQuery(query).then(function (coords) {
          if (coords) {
            item.mapLat = coords[0];
            item.mapLng = coords[1];
          }
        });
      });
    }, Promise.resolve());
  }

  function finishMarkerRender(token, allList, placed, skipped) {
    if (token !== renderToken || !isMapView || !map) return;

    invalidateMapSize(0);
    var mappable = (allList || []).filter(function (item) {
      return coordsForItem(item) != null;
    });

    renderSidebar(allList, mappable);

    if (!placed) {
      map.setView([54.5, -2.5], 6);
      if (skipped || (allList && allList.length)) {
        setMapHint(
          allList && allList.length
            ? 'No mappable locations in your current filters. Try clearing location filters or add a city or postcode to listings.'
            : 'No opportunities to show on the map yet.'
        );
      } else {
        setMapHint('');
      }
      return;
    }

    setMapHint('');
    var coordsList = mappable.map(coordsForItem);
    scheduleMapFit(coordsList);
  }

  function renderMarkers(list) {
    if (!isMapView) return;
    if (!mapReady) {
      var ensureLeaflet = window.hubEnsureLeafletReady || function (cb) {
        cb();
      };
      ensureLeaflet(function () {
        initMap();
        renderMarkers(list);
      });
      return;
    }
    if (!markerLayer || !map) return;

    var token = ++renderToken;
    if (markerLayer && typeof markerLayer.clearLayers === 'function') {
      markerLayer.clearLayers();
    }
    markersById = Object.create(null);
    sidebarVisibleCount = SIDEBAR_PAGE;
    sidebarItemsCache = [];
    setMapHint('');
    lastFilteredList = list || [];

    var placed = 0;
    var skipped = 0;
    var pending = [];

    lastFilteredList.forEach(function (item) {
      var coords = coordsForItem(item);
      if (coords) {
        addMarker(item, coords);
        placed++;
      } else if (isMappableLocation(item)) {
        pending.push(item);
        skipped++;
      } else {
        skipped++;
      }
    });

    if (!pending.length) {
      finishMarkerRender(token, lastFilteredList, placed, skipped);
      return;
    }

    if (placed) {
      var initialCoords = lastFilteredList
        .map(coordsForItem)
        .filter(function (c) {
          return c != null;
        });
      scheduleMapFit(initialCoords);
    }

    enrichOpportunityCoords(pending)
      .then(function () {
        if (token !== renderToken || !isMapView) return;

        pending.forEach(function (item) {
          var coords = coordsForItem(item);
          if (!coords) return;
          addMarker(item, coords);
          placed++;
          skipped = Math.max(0, skipped - 1);
        });

        finishMarkerRender(token, lastFilteredList, placed, skipped);
      })
      .catch(function () {
        finishMarkerRender(token, lastFilteredList, placed, skipped);
      });
  }

  function syncSidebarLayout() {
    var mobile = isMobileMapLayout();
    if (lastLayoutMobile === mobile) return;
    lastLayoutMobile = mobile;
    clearPanelInlineSize();
    ensurePanelSize();
    if (map) invalidateMapSize(0);
  }

  function setSidebarListOpen(open) {
    if (!mapSidebar || !mapListToggle) return;
    mapListToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    mapSidebar.classList.toggle('is-collapsed', !open);
    if (mapSidebarCountBtn) {
      mapSidebarCountBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    if (mapListToggleLabel) {
      mapListToggleLabel.textContent = open ? 'Hide list' : 'Show list';
    }
    if (mapSidebarCountHint) {
      mapSidebarCountHint.textContent = open ? 'Tap to hide listings' : 'Tap to show listings';
    }
    if (map) {
      setTimeout(function () {
        invalidateMapSize(0);
      }, 180);
    }
  }

  function syncViewButtons() {
    if (viewGridBtn) {
      viewGridBtn.classList.toggle('is-active', false);
      viewGridBtn.setAttribute('aria-pressed', 'false');
    }
    if (viewListBtn) {
      viewListBtn.classList.toggle('is-active', false);
      viewListBtn.setAttribute('aria-pressed', 'false');
    }
    if (viewMapBtn) {
      viewMapBtn.classList.toggle('is-active', isMapView);
      viewMapBtn.setAttribute('aria-pressed', isMapView ? 'true' : 'false');
    }
  }

  function setMapView(enabled) {
    isMapView = !!enabled;
    document.body.classList.toggle('opp-view-map', isMapView);
    if (mapWrap) mapWrap.hidden = !isMapView;
    if (listingsMount) listingsMount.hidden = isMapView;
    if (featuredBanner) featuredBanner.hidden = isMapView;
    syncViewButtons();

    if (!isMapView) {
      setMapHint('');
      highlightSidebarItem(null);
      lastLayoutMobile = null;
      clearPanelInlineSize();
      return;
    }

    lastLayoutMobile = isMobileMapLayout();
    var list = window.hubGetFilteredOpportunities ? window.hubGetFilteredOpportunities() : [];

    whenPanelReady(function () {
      var ensureLeaflet = window.hubEnsureLeafletReady || function (cb) {
        cb();
      };
      ensureLeaflet(function () {
        initMap();
        invalidateMapSize(0);
        if (isMobileMapLayout() && mapSidebar && mapListToggle) {
          setSidebarListOpen(true);
        }
        renderMarkers(list);
        if (mapWrap && mapWrap.scrollIntoView && !isMobileMapLayout()) {
          mapWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        setTimeout(function () {
          invalidateMapSize(0);
        }, 250);
        setTimeout(function () {
          invalidateMapSize(0);
        }, 600);
      });
    });
  }

  window.hubSetOppMapView = function (enabled) {
    setMapView(!!enabled);
  };

  window.hubRefreshOpportunitiesMap = function (filtered) {
    if (!isMapView) return;
    renderMarkers(filtered || lastFilteredList || []);
  };

  if (mapSidebarList) {
    mapSidebarList.addEventListener('click', function (e) {
      var btn = e.target.closest('.opp-map-sidebar-item-btn');
      if (!btn) return;
      var item = btn.closest('.opp-map-sidebar-item');
      if (!item) return;
      focusMarker(item.getAttribute('data-opp-id'));
    });
  }

  if (mapSidebarLoadMore) {
    mapSidebarLoadMore.addEventListener('click', function () {
      sidebarVisibleCount += SIDEBAR_PAGE;
      paintSidebarList(sidebarItemsCache.length);
    });
  }

  if (mapListToggle && mapSidebar) {
    mapListToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = mapListToggle.getAttribute('aria-expanded') === 'true';
      setSidebarListOpen(!open);
    });
  }

  if (mapSidebarCountBtn) {
    mapSidebarCountBtn.addEventListener('click', function () {
      var open = mapListToggle && mapListToggle.getAttribute('aria-expanded') === 'true';
      setSidebarListOpen(!open);
    });
  }

  window.addEventListener('resize', function () {
    if (!isMapView) return;
    syncSidebarLayout();
    ensurePanelSize();
    if (map) invalidateMapSize(0);
  });

  window.addEventListener('orientationchange', function () {
    if (!isMapView || !map) return;
    lastLayoutMobile = null;
    syncSidebarLayout();
    clearPanelInlineSize();
    ensurePanelSize();
    setTimeout(function () {
      invalidateMapSize(0);
    }, 350);
  });
})();
