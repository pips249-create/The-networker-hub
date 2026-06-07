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

  function invalidateMapSize(attempt) {
    if (!map) return;
    map.invalidateSize(true);
    var size = map.getSize();
    if ((size.x === 0 || size.y === 0) && attempt < 5) {
      setTimeout(function () {
        invalidateMapSize(attempt + 1);
      }, 80 * (attempt + 1));
    }
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

    requestAnimationFrame(function () {
      initMap();
      requestAnimationFrame(function () {
        invalidateMapSize(0);
        renderMarkers(list);
        if (mapPanel && mapPanel.scrollIntoView) {
          mapPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  window.hubToggleMapView = function () {
    setViewMode(!isMapView);
  };

  function renderMarkers(events) {
    if (!isMapView) return;
    if (!mapReady) initMap();
    if (!markerLayer || !map) return;

    var token = ++renderToken;
    markerLayer.clearLayers();
    setMapHint('');

    var enrich = window.hubEnrichEventCoords
      ? window.hubEnrichEventCoords(events || [])
      : Promise.resolve();

    enrich.then(function () {
      if (token !== renderToken || !isMapView) return;

      var bounds = [];
      var placed = 0;
      var skipped = 0;

      (events || []).forEach(function (ev) {
        var coords = coordsForEvent(ev);
        if (!coords) {
          skipped++;
          return;
        }
        bounds.push(coords);
        placed++;
        var pc = ev.postcode || (window.hubExtractPostcode ? window.hubExtractPostcode(ev) : '');
        var popup =
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
          '">View event</a></div>';
        markerLayer.addLayer(L.marker(coords).bindPopup(popup));
      });

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

      if (bounds.length === 1) {
        map.setView(bounds[0], 13);
      } else {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
      }
    });
  }

  window.hubRefreshMap = function (filtered) {
    if (!isMapView) return;
    renderMarkers(filtered || []);
  };
})();
