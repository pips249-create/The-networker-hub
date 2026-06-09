/**
 * Leaflet map — pins from UK postcodes (postcodes.io).
 */
(function () {
  var mapWrap = document.getElementById('events-map-wrap');
  var mapPanel = document.getElementById('events-map-panel');
  var mapHint = document.getElementById('events-map-hint');
  var mapSidebarList = document.getElementById('map-sidebar-list');
  var mapSidebarCount = document.getElementById('map-sidebar-count');
  var mapSidebarSub = document.getElementById('map-sidebar-sub');
  var mapSidebar = document.getElementById('events-map-sidebar');
  var mapSidebarHead = document.getElementById('events-map-sidebar-head');
  var mapSidebarCountBtn = document.getElementById('map-sidebar-count-btn');
  var mapSidebarCountHint = document.getElementById('map-sidebar-count-hint');
  var mapListToggle = document.getElementById('map-list-toggle');
  var mapListToggleLabel = document.getElementById('map-list-toggle-label');
  var mapMobileListBtn = document.getElementById('map-mobile-list-btn');
  var mapSidebarFoot = document.getElementById('map-sidebar-foot');
  var mapSidebarLoadMore = document.getElementById('map-sidebar-load-more');
  var mapSearchAreaBtn = document.getElementById('map-search-area-btn');
  var mapAreaActive = document.getElementById('map-area-active');
  var mapAreaActiveLabel = document.getElementById('map-area-active-label');
  var mapAreaResetBtn = document.getElementById('map-area-reset-btn');
  var listingsView = document.getElementById('listings-view');
  var mapBtn = document.getElementById('map-view-btn');
  var mapLabel = document.getElementById('map-view-label');
  var promoSection = document.querySelector('.events-promo-section');
  var resultsMeta = document.querySelector('.events-results-meta');

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
  var VIEW_MODE_KEY = 'hub-events-view-mode';
  var viewportFilterActive = false;
  var suppressMapEvents = 0;
  var mapUserMoved = false;
  var moveEndTimer = null;
  var nearMeCircle = null;

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function formatClass(ev) {
    var raw = String(ev.formatSlug || ev.format || ev.meetingType || '').toLowerCase();
    if (raw.indexOf('online') !== -1 && raw.indexOf('person') === -1) return 'online';
    if (raw.indexOf('hybrid') !== -1) return 'hybrid';
    return 'in-person';
  }

  function isMapMappableFormat(ev) {
    return formatClass(ev) === 'in-person';
  }

  function coordsForEvent(ev) {
    if (!isMapMappableFormat(ev)) return null;
    if (ev.mapLat != null && ev.mapLng != null) {
      return [ev.mapLat, ev.mapLng];
    }
    if (Number.isFinite(ev.lat) && Number.isFinite(ev.lng)) {
      return [ev.lat, ev.lng];
    }
    return null;
  }

  function eventHref(ev) {
    if (window.hubEventDetailHref) return window.hubEventDetailHref(ev);
    var slug = ev.slug ? String(ev.slug).trim() : '';
    var uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slug);
    if (slug && !uuidLike) return '/events/' + encodeURIComponent(slug);
    return 'event.html?id=' + encodeURIComponent(ev.id);
  }

  function formatLabel(ev) {
    var cls = formatClass(ev);
    if (cls === 'online') return 'Online';
    if (cls === 'hybrid') return 'Hybrid';
    return 'In person';
  }

  function locationLabel(ev) {
    return (
      ev.locationShort ||
      ev.city ||
      ev.venue ||
      ev.postcode ||
      (window.hubExtractPostcode ? window.hubExtractPostcode(ev) : '') ||
      ev.location ||
      ''
    );
  }

  function distanceMiles(ev, userCoords) {
    if (!userCoords || !window.hubDistanceMiles) return null;
    var coords = coordsForEvent(ev);
    if (!coords) return null;
    return window.hubDistanceMiles(userCoords[0], userCoords[1], coords[0], coords[1]);
  }

  function distanceText(miles) {
    if (miles == null || !Number.isFinite(miles)) return '';
    if (miles < 1) return 'Less than 1 mile away';
    if (miles < 10) return miles.toFixed(1) + ' miles away';
    return Math.round(miles) + ' miles away';
  }

  function postcodeQuery() {
    var pcInput = document.getElementById('postcode');
    return pcInput && pcInput.value ? pcInput.value.trim() : '';
  }

  function resolveUserCoords() {
    if (isNearMeActive() && window.hubUserCoords) return Promise.resolve(window.hubUserCoords);
    if (window.hubLocationFilterCoords) return Promise.resolve(window.hubLocationFilterCoords);
    var pc = postcodeQuery();
    if (pc && window.hubGeocodeLocationQuery) {
      return window.hubGeocodeLocationQuery(pc).then(function (coords) {
        window.hubLocationFilterCoords = coords;
        return coords;
      });
    }
    if (window.hubUserCoords) return Promise.resolve(window.hubUserCoords);
    return Promise.resolve(null);
  }

  function hasDistanceCenter() {
    return !!(window.hubUserCoords || window.hubLocationFilterCoords);
  }

  function isLocationRadiusActive() {
    return isNearMeActive() || !!postcodeQuery();
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

  function isNearMeActive() {
    return !!(window.hubIsNearMeActive && window.hubIsNearMeActive());
  }

  function getNearRadiusMiles() {
    return window.hubNearRadiusMiles ? window.hubNearRadiusMiles() : 25;
  }

  function eventWithinLocationRadius(ev, centerCoords) {
    if (!isLocationRadiusActive() || !centerCoords) return true;
    if (formatClass(ev) === 'online') return true;
    var coords = coordsForEvent(ev);
    if (coords && window.hubDistanceMiles) {
      return (
        window.hubDistanceMiles(centerCoords[0], centerCoords[1], coords[0], coords[1]) <=
        getNearRadiusMiles()
      );
    }
    if (isNearMeActive()) return false;
    var pc = postcodeQuery();
    if (pc && window.hubMatchOutcode) return window.hubMatchOutcode(pc, ev);
    return !pc;
  }

  function filterEventsForMap(events, centerCoords) {
    var list = events || [];
    if (viewportFilterActive && map) {
      list = filterEventsInBounds(list);
    }
    if (isLocationRadiusActive()) {
      list = list.filter(function (ev) {
        return eventWithinLocationRadius(ev, centerCoords);
      });
    }
    return list;
  }

  function clearNearMeCircle() {
    if (nearMeCircle && map) {
      map.removeLayer(nearMeCircle);
      nearMeCircle = null;
    }
  }

  function updateNearMeCircle(centerCoords) {
    clearNearMeCircle();
    if (!map || !isLocationRadiusActive() || !centerCoords) return;
    var radiusMeters = getNearRadiusMiles() * 1609.344;
    nearMeCircle = L.circle(centerCoords, {
      radius: radiusMeters,
      color: '#9a7aa8',
      fillColor: '#c299d1',
      fillOpacity: 0.14,
      weight: 2,
    }).addTo(map);
    nearMeCircle.bringToBack();
  }

  function fitMapToLocationRadius(centerCoords) {
    if (!map || !centerCoords) return;
    var radiusMeters = getNearRadiusMiles() * 1609.344;
    var bounds = L.circle(centerCoords, { radius: radiusMeters }).getBounds();
    suppressMapEvents++;
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 13 });
    setTimeout(function () {
      suppressMapEvents = Math.max(0, suppressMapEvents - 1);
    }, 400);
  }

  function markerIconForEvent(ev) {
    return L.divIcon({
      className: 'hub-map-pin hub-map-pin--in-person',
      html: '<span class="hub-map-pin-dot" aria-hidden="true"></span>',
      iconSize: [26, 26],
      iconAnchor: [13, 26],
      popupAnchor: [0, -24],
    });
  }

  function nearMeSubSuffix() {
    return isLocationRadiusActive() ? ' · within ' + getNearRadiusMiles() + ' miles' : '';
  }

  function formatSidebarSub(onMap, total, hasCoords) {
    var shown = Math.min(sidebarVisibleCount, onMap);
    var more = onMap > sidebarVisibleCount ? '+' : '';
    var nearSuffix = nearMeSubSuffix();
    if (viewportFilterActive) {
      var areaLead = onMap + ' in this area · ' + total + ' matching · showing ';
      if (hasCoords) {
        return areaLead + 'nearest ' + shown + more + nearSuffix;
      }
      return areaLead + shown + more + ' · add postcode for distances' + nearSuffix;
    }
    if (hasCoords) {
      return (
        onMap +
        ' of ' +
        total +
        ' matching · showing nearest ' +
        shown +
        more +
        nearSuffix
      );
    }
    return (
      onMap +
      ' of ' +
      total +
      ' matching · showing ' +
      shown +
      more +
      ' · add postcode for distances' +
      nearSuffix
    );
  }

  function updateSidebarSub(onMap, total) {
    if (!mapSidebarSub) return;
    var t = total != null ? total : sidebarMetaTotal;
    mapSidebarSub.textContent = formatSidebarSub(onMap, t, hasDistanceCenter());
  }

  function filterEventsInBounds(events) {
    if (!map) return events || [];
    var bounds = map.getBounds();
    return (events || []).filter(function (ev) {
      var coords = coordsForEvent(ev);
      return coords && bounds.contains(coords);
    });
  }

  function hideSearchAreaPrompt() {
    if (mapSearchAreaBtn) mapSearchAreaBtn.hidden = true;
  }

  function updateViewportControls(inAreaCount) {
    if (!mapSearchAreaBtn || !mapAreaActive) return;
    if (viewportFilterActive) {
      hideSearchAreaPrompt();
      mapAreaActive.hidden = false;
      if (mapAreaActiveLabel) {
        mapAreaActiveLabel.textContent = String(inAreaCount) + ' in this area';
      }
    } else {
      mapAreaActive.hidden = true;
    }
  }

  function clearViewportFilter(rerender) {
    viewportFilterActive = false;
    mapUserMoved = false;
    hideSearchAreaPrompt();
    if (mapAreaActive) mapAreaActive.hidden = true;
    if (rerender !== false && lastFilteredList.length && isMapView) {
      renderMarkers(lastFilteredList);
    }
  }

  function applyViewportFilter() {
    if (!map || !lastFilteredList.length) return;
    viewportFilterActive = true;
    mapUserMoved = false;
    hideSearchAreaPrompt();
    renderMarkers(lastFilteredList);
  }

  function onMapMoveEnd() {
    if (!isMapView || suppressMapEvents > 0 || viewportFilterActive) return;
    if (!mapUserMoved) return;
    clearTimeout(moveEndTimer);
    moveEndTimer = setTimeout(function () {
      if (mapSearchAreaBtn && !viewportFilterActive) {
        mapSearchAreaBtn.hidden = false;
      }
    }, 350);
  }

  function bindMapViewportEvents() {
    if (!map || map._hubViewportBound) return;
    map._hubViewportBound = true;
    map.on('movestart zoomstart', function () {
      if (suppressMapEvents > 0) return;
      mapUserMoved = true;
    });
    map.on('moveend', onMapMoveEnd);
  }

  function saveViewMode(mode) {
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch (err) {
      /* ignore */
    }
  }

  function syncSidebarLayout() {
    if (!isMapView || !mapSidebar || !mapListToggle) return;
    var mobile = isMobileMapLayout();
    if (lastLayoutMobile === mobile) return;
    lastLayoutMobile = mobile;
    clearPanelInlineSize();
    if (!mobile) {
      setSidebarListOpen(true);
    }
    if (map) {
      setTimeout(function () {
        invalidateMapSize(0);
      }, 180);
    }
  }

  function panelHasSize() {
    if (!mapPanel || !mapWrap || mapWrap.hidden) return false;
    return mapPanel.offsetWidth > 0 && mapPanel.offsetHeight > 0;
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
    bindMapViewportEvents();
  }

  function setChromeHidden(mapMode) {
    if (promoSection) promoSection.hidden = mapMode;
  }

  function fitMapToCoords(coordsList) {
    if (!map || !coordsList.length) return;
    suppressMapEvents++;
    if (coordsList.length === 1) {
      map.setView(coordsList[0], 13);
    } else {
      map.fitBounds(L.latLngBounds(coordsList), { padding: [48, 48], maxZoom: 13 });
    }
    setTimeout(function () {
      suppressMapEvents = Math.max(0, suppressMapEvents - 1);
    }, 400);
  }

  function fitMapToMarkers(coordsList) {
    if (!map) return;
    suppressMapEvents++;
    if (markerLayer && typeof markerLayer.getBounds === 'function') {
      try {
        var bounds = markerLayer.getBounds();
        if (bounds && bounds.isValid && bounds.isValid()) {
          map.fitBounds(bounds, { padding: [48, 48], maxZoom: 13 });
          setTimeout(function () {
            suppressMapEvents = Math.max(0, suppressMapEvents - 1);
          }, 400);
          return;
        }
      } catch (err) {
        /* fall through */
      }
    }
    suppressMapEvents = Math.max(0, suppressMapEvents - 1);
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

  function popupHtml(ev, miles) {
    var fmtClass = formatClass(ev);
    var fmtLabel = formatLabel(ev);
    var loc = locationLabel(ev);
    var dist = distanceText(miles);
    var premium = ev.featured
      ? '<span class="map-event-card-premium">Premium</span>'
      : '';

    return (
      '<div class="map-event-card">' +
      '<div class="map-event-card-top">' +
      premium +
      '<span class="map-event-card-format ' +
      escapeHtml(fmtClass) +
      '">' +
      escapeHtml(fmtLabel) +
      '</span>' +
      '<span class="map-event-card-price">' +
      escapeHtml(ev.price || 'Free') +
      '</span>' +
      '</div>' +
      '<h3 class="map-event-card-title">' +
      escapeHtml(ev.title) +
      '</h3>' +
      '<p class="map-event-card-meta">' +
      escapeHtml(ev.dateLine || ev.date || 'Date TBC') +
      '</p>' +
      (loc ? '<p class="map-event-card-location">' + escapeHtml(loc) + '</p>' : '') +
      (dist ? '<p class="map-event-card-distance">' + escapeHtml(dist) + '</p>' : '') +
      '<a class="map-event-card-cta btn btn-primary" href="' +
      escapeHtml(eventHref(ev)) +
      '">View event</a>' +
      '</div>'
    );
  }

  function highlightSidebarItem(eventId) {
    activeSidebarId = eventId || null;
    if (!mapSidebarList) return;
    mapSidebarList.querySelectorAll('.map-sidebar-item').forEach(function (item) {
      var active = item.getAttribute('data-event-id') === eventId;
      item.classList.toggle('is-active', active);
    });
  }

  function focusMarker(eventId) {
    var marker = markersById[eventId];
    if (!marker || !map) return;

    function openFocused() {
      suppressMapEvents++;
      map.setView(marker.getLatLng(), Math.max(map.getZoom(), 13));
      marker.openPopup();
      highlightSidebarItem(eventId);
      setTimeout(function () {
        suppressMapEvents = Math.max(0, suppressMapEvents - 1);
      }, 400);
    }

    if (markerLayer && typeof markerLayer.zoomToShowLayer === 'function') {
      markerLayer.zoomToShowLayer(marker, openFocused);
    } else {
      openFocused();
    }
  }

  function addMarker(ev, coords, miles) {
    var popupMax = Math.min(280, Math.max(220, (window.innerWidth || 320) - 48));
    var marker = L.marker(coords, { icon: markerIconForEvent(ev) }).bindPopup(popupHtml(ev, miles), {
      className: 'map-event-popup',
      maxWidth: popupMax,
      minWidth: Math.min(220, popupMax),
    });
    marker.on('popupopen', function () {
      highlightSidebarItem(ev.id);
    });
    marker.on('popupclose', function () {
      if (activeSidebarId === ev.id) highlightSidebarItem(null);
    });
    markersById[ev.id] = marker;
    markerLayer.addLayer(marker);
  }

  function sidebarItemLabel(item) {
    var ev = item.ev;
    var dist = distanceText(item.miles);
    var parts = [ev.title, ev.dateLine || ev.date || 'Date TBC'];
    if (dist) parts.push(dist);
    return parts.join(', ');
  }

  function sidebarItemHtml(item) {
    var ev = item.ev;
    var dist = distanceText(item.miles);
    var meta = [ev.dateLine || ev.date || 'Date TBC'];
    if (dist) meta.push(dist);
    return (
      '<li class="map-sidebar-item" data-event-id="' +
      escapeHtml(ev.id) +
      '">' +
      '<button type="button" class="map-sidebar-item-btn" aria-label="' +
      escapeHtml(sidebarItemLabel(item)) +
      '">' +
      '<span class="map-sidebar-item-title">' +
      escapeHtml(ev.title) +
      '</span>' +
      '<span class="map-sidebar-item-meta">' +
      escapeHtml(meta.join(' · ')) +
      '</span>' +
      '<span class="map-sidebar-item-price">' +
      escapeHtml(ev.price || 'Free') +
      '</span>' +
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

  function renderSidebar(allList, mappableList) {
    if (!mapSidebarList || !mapSidebarCount) return;

    var total = (allList || []).length;
    var onMap = (mappableList || []).length;
    sidebarVisibleCount = SIDEBAR_PAGE;
    sidebarMetaTotal = total;
    mapSidebarCount.textContent = String(onMap);

    if (!onMap) {
      sidebarItemsCache = [];
      if (mapSidebarSub) {
        mapSidebarSub.textContent = viewportFilterActive && total
          ? 'No events in this map area · ' + total + ' match your filters'
          : isLocationRadiusActive() && total
            ? 'No events within ' + getNearRadiusMiles() + ' miles · ' + total + ' match your filters'
            : total
              ? 'No mappable in-person events match your filters.'
              : 'No events to show yet.';
      }
      mapSidebarList.innerHTML = '';
      if (mapSidebarFoot) mapSidebarFoot.hidden = true;
      return;
    }

    resolveUserCoords().then(function (userCoords) {
      if (!isMapView) return;

      sidebarItemsCache = mappableList.map(function (ev) {
        return {
          ev: ev,
          miles: distanceMiles(ev, userCoords),
        };
      });

      if (userCoords) {
        sidebarItemsCache.sort(function (a, b) {
          if (a.miles == null) return 1;
          if (b.miles == null) return -1;
          return a.miles - b.miles;
        });
      }

      updateSidebarSub(onMap, total);
      paintSidebarList(onMap);
      updateViewportControls(onMap);
    });
  }

  if (mapSidebarList) {
    mapSidebarList.addEventListener('click', function (e) {
      var btn = e.target.closest('.map-sidebar-item-btn');
      if (!btn) return;
      var item = btn.closest('.map-sidebar-item');
      if (!item) return;
      focusMarker(item.getAttribute('data-event-id'));
    });
  }

  if (mapSidebarLoadMore) {
    mapSidebarLoadMore.addEventListener('click', function () {
      sidebarVisibleCount += SIDEBAR_PAGE;
      var onMap = sidebarItemsCache.length;
      paintSidebarList(onMap);
      if (onMap) updateSidebarSub(onMap, sidebarMetaTotal);
    });
  }

  if (mapListToggle && mapSidebar) {
    mapListToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = mapListToggle.getAttribute('aria-expanded') === 'true';
      setSidebarListOpen(!open);
    });
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
      mapSidebarCountHint.textContent = open ? 'Tap to hide events' : 'Tap to show events';
    }
    if (map) {
      setTimeout(function () {
        invalidateMapSize(0);
      }, 180);
    }
  }

  if (mapSidebarCountBtn) {
    mapSidebarCountBtn.addEventListener('click', function () {
      var open = mapListToggle && mapListToggle.getAttribute('aria-expanded') === 'true';
      setSidebarListOpen(!open);
    });
  }

  function bindMapExit(btn) {
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (isMapView) window.hubToggleMapView();
    });
  }

  bindMapExit(mapMobileListBtn);

  if (mapSearchAreaBtn) {
    mapSearchAreaBtn.addEventListener('click', function () {
      applyViewportFilter();
    });
  }

  if (mapAreaResetBtn) {
    mapAreaResetBtn.addEventListener('click', function () {
      clearViewportFilter(true);
      var mappable = lastFilteredList.filter(function (ev) {
        return coordsForEvent(ev) != null;
      });
      var coordsList = mappable.map(function (ev) {
        return coordsForEvent(ev);
      });
      if (coordsList.length) scheduleMapFit(coordsList);
    });
  }

  function setViewMode(mapMode) {
    isMapView = mapMode;
    document.body.classList.toggle('events-view-map', mapMode);
    if (mapWrap) mapWrap.hidden = !mapMode;
    if (listingsView) listingsView.hidden = mapMode;
    if (mapBtn) mapBtn.setAttribute('aria-pressed', mapMode ? 'true' : 'false');
    if (mapLabel) {
      var compact = window.matchMedia('(max-width: 720px)').matches;
      mapLabel.textContent = mapMode
        ? compact
          ? 'List'
          : 'Swap to List View'
        : compact
          ? 'Map'
          : 'Swap to Map View';
    }
    setChromeHidden(mapMode);
    if (!document.body.classList.contains('browse-mode-organisers')) {
      saveViewMode(mapMode ? 'map' : 'list');
    }
    if (!mapMode) {
      setMapHint('');
      highlightSidebarItem(null);
      lastLayoutMobile = null;
      clearPanelInlineSize();
      clearViewportFilter(false);
      clearNearMeCircle();
      return;
    }

    viewportFilterActive = false;
    mapUserMoved = false;
    hideSearchAreaPrompt();
    if (mapAreaActive) mapAreaActive.hidden = true;

    lastLayoutMobile = isMobileMapLayout();

    var list = window.hubGetFilteredEvents
      ? window.hubGetFilteredEvents(window.hubAllEvents || [])
      : window.hubAllEvents || [];
    lastFilteredList = list;

    whenPanelReady(function () {
      initMap();
      invalidateMapSize(0);
      if (window.matchMedia('(max-width: 900px)').matches && mapSidebar && mapListToggle) {
        setSidebarListOpen(true);
      }
      renderMarkers(list);
      if (
        mapWrap &&
        mapWrap.scrollIntoView &&
        !window.matchMedia('(max-width: 900px)').matches
      ) {
        mapWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setTimeout(function () {
        invalidateMapSize(0);
      }, 250);
      setTimeout(function () {
        invalidateMapSize(0);
      }, 600);
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

  window.hubToggleMapView = function () {
    setViewMode(!isMapView);
  };

  if (mapBtn) {
    mapBtn.addEventListener('click', function (e) {
      e.preventDefault();
      window.hubToggleMapView();
    });
  }

  function finishMarkerRender(token, events, placed, skipped, userCoords) {
    if (token !== renderToken || !isMapView || !map) return;

    invalidateMapSize(0);
    updateNearMeCircle(userCoords);

    var sourceEvents = events || [];
    var displayEvents = filterEventsForMap(sourceEvents, userCoords);
    var mappable = displayEvents.filter(function (ev) {
      return coordsForEvent(ev) != null;
    });

    renderSidebar(sourceEvents, mappable);

    if (!placed) {
      if (isNearMeActive() && !userCoords) {
        setMapHint('Turn on location access or enter a postcode to use Near me on the map.');
      } else if (viewportFilterActive && sourceEvents.length) {
        setMapHint('No events in this map area. Pan the map or tap Show all.');
      } else if (isLocationRadiusActive() && sourceEvents.length) {
        setMapHint('No events within ' + getNearRadiusMiles() + ' miles. Try a wider radius.');
      } else {
        map.setView([54.5, -2.5], 6);
        if (skipped) {
          setMapHint(
            sourceEvents.length
              ? 'No mappable in-person events in your current filters. Try clearing filters or add postcodes to events in Supabase.'
              : 'No events to show on the map yet.'
          );
        }
      }
      return;
    }

    setMapHint('');
    if (isLocationRadiusActive() && userCoords && !viewportFilterActive) {
      fitMapToLocationRadius(userCoords);
      return;
    }
    var coordsList = mappable.map(function (ev) {
      return coordsForEvent(ev);
    });
    if (!viewportFilterActive) {
      scheduleMapFit(coordsList);
    }
  }

  function renderMarkers(events) {
    if (!isMapView) return;
    if (!mapReady) initMap();
    if (!markerLayer || !map) return;

    var token = ++renderToken;
    if (markerLayer && typeof markerLayer.clearLayers === 'function') {
      markerLayer.clearLayers();
    }
    markersById = Object.create(null);
    sidebarVisibleCount = SIDEBAR_PAGE;
    sidebarItemsCache = [];
    if (!viewportFilterActive) {
      setMapHint('');
    }
    lastFilteredList = events || [];

    var placed = 0;
    var skipped = 0;
    var pending = [];

    resolveUserCoords().then(function (userCoords) {
      if (token !== renderToken || !isMapView) return;

      var list = filterEventsForMap(lastFilteredList, userCoords);

      list.forEach(function (ev) {
        var coords = coordsForEvent(ev);
        if (coords) {
          addMarker(ev, coords, distanceMiles(ev, userCoords));
          placed++;
        } else if (isMapMappableFormat(ev)) {
          pending.push(ev);
          skipped++;
        } else {
          skipped++;
        }
      });

      if (!pending.length) {
        finishMarkerRender(token, lastFilteredList, placed, skipped, userCoords);
        return;
      }

      if (placed && !viewportFilterActive && !(isLocationRadiusActive() && userCoords)) {
        var initialCoords = [];
        list.forEach(function (ev) {
          var coords = coordsForEvent(ev);
          if (coords) initialCoords.push(coords);
        });
        scheduleMapFit(initialCoords);
      }

      var enrich = window.hubEnrichEventCoords
        ? window.hubEnrichEventCoords(pending, { noTimeout: true })
        : Promise.resolve();

      enrich
        .then(function () {
          if (token !== renderToken || !isMapView) return;

          pending.forEach(function (ev) {
            var coords = coordsForEvent(ev);
            if (!coords || !eventWithinNearMe(ev, userCoords)) return;
            addMarker(ev, coords, distanceMiles(ev, userCoords));
            placed++;
            skipped--;
          });

          finishMarkerRender(token, lastFilteredList, placed, skipped, userCoords);
        })
        .catch(function () {
          finishMarkerRender(token, lastFilteredList, placed, skipped, userCoords);
        });
    });
  }

  window.hubRefreshMap = function (filtered) {
    if (!isMapView) return;
    clearViewportFilter(false);
    clearNearMeCircle();
    renderMarkers(filtered || lastFilteredList || []);
  };

  window.hubTryRestoreMapView = function () {
    if (isMapView) return;
    if (document.body.classList.contains('browse-mode-organisers')) return;
    try {
      if (localStorage.getItem(VIEW_MODE_KEY) === 'map') {
        setViewMode(true);
      }
    } catch (err) {
      /* ignore */
    }
  };
})();
