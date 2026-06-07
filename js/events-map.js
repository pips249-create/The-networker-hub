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
  var mapListToggle = document.getElementById('map-list-toggle');
  var mapListToggleLabel = document.getElementById('map-list-toggle-label');
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

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function coordsForEvent(ev) {
    if (ev.mapLat != null && ev.mapLng != null) {
      return [ev.mapLat, ev.mapLng];
    }
    if (Number.isFinite(ev.lat) && Number.isFinite(ev.lng)) {
      return [ev.lat, ev.lng];
    }
    if (ev.formatSlug === 'online') return null;
    return null;
  }

  function eventHref(ev) {
    if (window.hubEventDetailHref) return window.hubEventDetailHref(ev);
    var slug = ev.slug ? String(ev.slug).trim() : '';
    var uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slug);
    if (slug && !uuidLike) return '/events/' + encodeURIComponent(slug);
    return 'event.html?id=' + encodeURIComponent(ev.id);
  }

  function formatClass(ev) {
    var raw = String(ev.formatSlug || ev.format || ev.meetingType || '').toLowerCase();
    if (raw.indexOf('online') !== -1 && raw.indexOf('person') === -1) return 'online';
    if (raw.indexOf('hybrid') !== -1) return 'hybrid';
    return 'in-person';
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

  function resolveUserCoords() {
    if (window.hubUserCoords) return Promise.resolve(window.hubUserCoords);
    var pcInput = document.getElementById('postcode');
    var pc = pcInput && pcInput.value ? pcInput.value.trim() : '';
    if (pc && window.hubGeocodeUserPostcode) {
      return window.hubGeocodeUserPostcode(pc);
    }
    return Promise.resolve(null);
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
      if (panelHasSize() || attempt >= 12) {
        fn();
        return;
      }
      attempt++;
      requestAnimationFrame(tick);
    })();
  }

  function initMap() {
    if (mapReady || !mapPanel || typeof L === 'undefined') return;
    var touchDevice =
      window.matchMedia('(max-width: 900px)').matches ||
      (typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: coarse)').matches);
    map = L.map(mapPanel, {
      scrollWheelZoom: !touchDevice,
      tap: true,
    }).setView([54.5, -2.5], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
    mapReady = true;
  }

  function setChromeHidden(mapMode) {
    if (promoSection) promoSection.hidden = mapMode;
    if (resultsMeta) resultsMeta.hidden = mapMode;
  }

  function fitMapToCoords(coordsList) {
    if (!map || !coordsList.length) return;
    if (coordsList.length === 1) {
      map.setView(coordsList[0], 13);
      return;
    }
    map.fitBounds(L.latLngBounds(coordsList), { padding: [40, 40], maxZoom: 12 });
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
    map.setView(marker.getLatLng(), Math.max(map.getZoom(), 13));
    marker.openPopup();
    highlightSidebarItem(eventId);
  }

  function addMarker(ev, coords, miles) {
    var marker = L.marker(coords).bindPopup(popupHtml(ev, miles), {
      className: 'map-event-popup',
      maxWidth: 280,
      minWidth: 220,
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

  function renderSidebar(allList, mappableList) {
    if (!mapSidebarList || !mapSidebarCount) return;

    var total = (allList || []).length;
    var onMap = (mappableList || []).length;
    mapSidebarCount.textContent = String(onMap);

    if (!onMap) {
      if (mapSidebarSub) {
        mapSidebarSub.textContent = total
          ? 'No mappable in-person events match your filters.'
          : 'No events to show yet.';
      }
      mapSidebarList.innerHTML = '';
      return;
    }

    resolveUserCoords().then(function (userCoords) {
      if (!isMapView) return;

      var items = mappableList.map(function (ev) {
        return {
          ev: ev,
          miles: distanceMiles(ev, userCoords),
        };
      });

      if (userCoords) {
        items.sort(function (a, b) {
          if (a.miles == null) return 1;
          if (b.miles == null) return -1;
          return a.miles - b.miles;
        });
        if (mapSidebarSub) {
          mapSidebarSub.textContent =
            onMap +
            ' of ' +
            total +
            ' matching · sorted nearest first';
        }
      } else if (mapSidebarSub) {
        mapSidebarSub.textContent =
          onMap +
          ' of ' +
          total +
          ' matching · add your postcode above for distances';
      }

      mapSidebarList.innerHTML = items
        .map(function (item) {
          var ev = item.ev;
          var dist = distanceText(item.miles);
          var meta = [ev.dateLine || ev.date || 'Date TBC'];
          if (dist) meta.push(dist);
          return (
            '<li class="map-sidebar-item" data-event-id="' +
            escapeHtml(ev.id) +
            '">' +
            '<button type="button" class="map-sidebar-item-btn">' +
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
        })
        .join('');

      if (activeSidebarId && !markersById[activeSidebarId]) {
        highlightSidebarItem(null);
      }
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

  if (mapListToggle && mapSidebar) {
    mapListToggle.addEventListener('click', function () {
      var open = mapListToggle.getAttribute('aria-expanded') === 'true';
      var nextOpen = !open;
      mapListToggle.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
      mapSidebar.classList.toggle('is-collapsed', !nextOpen);
      if (mapListToggleLabel) {
        mapListToggleLabel.textContent = nextOpen ? 'Hide list' : 'Show list';
      }
      if (map) {
        setTimeout(function () {
          invalidateMapSize(0);
        }, 180);
      }
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
    if (!mapMode) {
      setMapHint('');
      highlightSidebarItem(null);
      return;
    }

    var list = window.hubGetFilteredEvents
      ? window.hubGetFilteredEvents(window.hubAllEvents || [])
      : window.hubAllEvents || [];
    lastFilteredList = list;

    whenPanelReady(function () {
      initMap();
      invalidateMapSize(0);
      if (
        window.matchMedia('(max-width: 900px)').matches &&
        mapSidebar &&
        mapListToggle
      ) {
        mapSidebar.classList.add('is-collapsed');
        mapListToggle.setAttribute('aria-expanded', 'false');
        if (mapListToggleLabel) mapListToggleLabel.textContent = 'Show list';
      }
      renderMarkers(list);
      if (mapWrap && mapWrap.scrollIntoView) {
        mapWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setTimeout(function () {
        invalidateMapSize(0);
      }, 250);
    });
  }

  window.hubToggleMapView = function () {
    setViewMode(!isMapView);
  };

  if (mapBtn) {
    mapBtn.addEventListener('click', function () {
      window.hubToggleMapView();
    });
  }

  function finishMarkerRender(token, events, placed, skipped) {
    if (token !== renderToken || !isMapView || !map) return;

    invalidateMapSize(0);

    var mappable = (events || []).filter(function (ev) {
      return coordsForEvent(ev) != null;
    });

    resolveUserCoords().then(function (userCoords) {
      if (token !== renderToken || !isMapView) return;
      renderSidebar(events, mappable);
    });

    if (!placed) {
      map.setView([54.5, -2.5], 6);
      if (skipped) {
        setMapHint(
          (events || []).length
            ? 'No mappable in-person events in your current filters. Try clearing filters or add postcodes to events in Supabase.'
            : 'No events to show on the map yet.'
        );
      }
      return;
    }

    setMapHint('');
    var coordsList = mappable.map(function (ev) {
      return coordsForEvent(ev);
    });
    fitMapToCoords(coordsList);
  }

  function renderMarkers(events) {
    if (!isMapView) return;
    if (!mapReady) initMap();
    if (!markerLayer || !map) return;

    var token = ++renderToken;
    markerLayer.clearLayers();
    markersById = Object.create(null);
    setMapHint('');
    lastFilteredList = events || [];

    var list = events || [];
    var placed = 0;
    var skipped = 0;
    var pending = [];

    resolveUserCoords().then(function (userCoords) {
      if (token !== renderToken || !isMapView) return;

      list.forEach(function (ev) {
        var coords = coordsForEvent(ev);
        if (coords) {
          addMarker(ev, coords, distanceMiles(ev, userCoords));
          placed++;
        } else if (ev.formatSlug !== 'online') {
          pending.push(ev);
          skipped++;
        } else {
          skipped++;
        }
      });

      if (!pending.length) {
        finishMarkerRender(token, list, placed, skipped);
        return;
      }

      if (placed) {
        var initialCoords = [];
        list.forEach(function (ev) {
          var coords = coordsForEvent(ev);
          if (coords) initialCoords.push(coords);
        });
        fitMapToCoords(initialCoords);
      }

      var enrich = window.hubEnrichEventCoords
        ? window.hubEnrichEventCoords(pending, { noTimeout: true })
        : Promise.resolve();

      enrich
        .then(function () {
          if (token !== renderToken || !isMapView) return;

          pending.forEach(function (ev) {
            var coords = coordsForEvent(ev);
            if (!coords) return;
            addMarker(ev, coords, distanceMiles(ev, userCoords));
            placed++;
            skipped--;
          });

          finishMarkerRender(token, list, placed, skipped);
        })
        .catch(function () {
          finishMarkerRender(token, list, placed, skipped);
        });
    });
  }

  window.hubRefreshMap = function (filtered) {
    if (!isMapView) return;
    renderMarkers(filtered || lastFilteredList || []);
  };

  window.addEventListener('resize', function () {
    if (isMapView) invalidateMapSize(0);
  });
})();
