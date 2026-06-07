/**
 * Leaflet map — pins from UK postcodes (postcodes.io).
 */
(function () {
  var mapPanel = document.getElementById('events-map-panel');
  var mapHint = document.getElementById('events-map-hint');
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
    if (!mapPanel || mapPanel.hidden) return false;
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
    map = L.map(mapPanel, { scrollWheelZoom: true }).setView([54.5, -2.5], 6);
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

  function popupHtml(ev) {
    var pc = ev.postcode || (window.hubExtractPostcode ? window.hubExtractPostcode(ev) : '');
    return (
      '<div class="map-popup">' +
      '<strong>' +
      escapeHtml(ev.title) +
      '</strong><br>' +
      escapeHtml(ev.dateLine || ev.date || 'Date TBC') +
      (pc ? '<br>' + escapeHtml(pc) : '') +
      '<br><span>' +
      escapeHtml(ev.price) +
      '</span><br>' +
      '<a href="' +
      escapeHtml(eventHref(ev)) +
      '">View event</a></div>'
    );
  }

  function addMarker(ev, coords) {
    markerLayer.addLayer(L.marker(coords).bindPopup(popupHtml(ev)));
  }

  function setViewMode(mapMode) {
    isMapView = mapMode;
    document.body.classList.toggle('events-view-map', mapMode);
    if (mapPanel) mapPanel.hidden = !mapMode;
    if (listingsView) listingsView.hidden = mapMode;
    if (mapBtn) mapBtn.setAttribute('aria-pressed', mapMode ? 'true' : 'false');
    if (mapLabel) {
      mapLabel.textContent = mapMode ? 'Swap to List View' : 'Swap to Map View';
    }
    setChromeHidden(mapMode);
    if (!mapMode) {
      setMapHint('');
      return;
    }

    var list = window.hubGetFilteredEvents
      ? window.hubGetFilteredEvents(window.hubAllEvents || [])
      : window.hubAllEvents || [];

    whenPanelReady(function () {
      initMap();
      invalidateMapSize(0);
      renderMarkers(list);
      if (mapPanel && mapPanel.scrollIntoView) {
        mapPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setTimeout(function () {
        invalidateMapSize(0);
      }, 250);
    });
  }

  window.hubToggleMapView = function () {
    setViewMode(!isMapView);
  };

  function finishMarkerRender(token, events, placed, skipped) {
    if (token !== renderToken || !isMapView || !map) return;

    invalidateMapSize(0);

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
    var coordsList = [];
    (events || []).forEach(function (ev) {
      var coords = coordsForEvent(ev);
      if (coords) coordsList.push(coords);
    });
    fitMapToCoords(coordsList);
  }

  function renderMarkers(events) {
    if (!isMapView) return;
    if (!mapReady) initMap();
    if (!markerLayer || !map) return;

    var token = ++renderToken;
    markerLayer.clearLayers();
    setMapHint('');

    var list = events || [];
    var placed = 0;
    var skipped = 0;
    var pending = [];

    list.forEach(function (ev) {
      var coords = coordsForEvent(ev);
      if (coords) {
        addMarker(ev, coords);
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
          addMarker(ev, coords);
          placed++;
          skipped--;
        });

        finishMarkerRender(token, list, placed, skipped);
      })
      .catch(function () {
        finishMarkerRender(token, list, placed, skipped);
      });
  }

  window.hubRefreshMap = function (filtered) {
    if (!isMapView) return;
    renderMarkers(filtered || []);
  };

  window.addEventListener('resize', function () {
    if (isMapView) invalidateMapSize(0);
  });
})();
