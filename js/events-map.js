/**
 * Leaflet map — pins from UK postcodes (postcodes.io).
 */
(function () {
  var mapPanel = document.getElementById('events-map-panel');
  var listingsView = document.getElementById('listings-view');
  var mapBtn = document.getElementById('map-view-btn');
  var mapLabel = document.getElementById('map-view-label');
  var promoSection = document.querySelector('.events-promo-section');

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

  function setViewMode(mapMode) {
    isMapView = mapMode;
    document.body.classList.toggle('events-view-map', mapMode);
    if (mapPanel) mapPanel.hidden = !mapMode;
    if (listingsView) listingsView.hidden = mapMode;
    if (mapBtn) mapBtn.setAttribute('aria-pressed', mapMode ? 'true' : 'false');
    if (mapLabel) {
      mapLabel.textContent = mapMode ? 'Swap to List View' : 'Swap to Map View';
    }
    if (mapMode) {
      initMap();
      setTimeout(function () {
        if (map) map.invalidateSize();
      }, 120);
      var list = window.hubGetFilteredEvents
        ? window.hubGetFilteredEvents(window.hubAllEvents || [])
        : window.hubAllEvents || [];
      renderMarkers(list);
    }
  }

  window.hubToggleMapView = function () {
    setViewMode(!isMapView);
  };

  function renderMarkers(events) {
    if (!mapReady) initMap();
    if (!markerLayer) return;

    var token = ++renderToken;
    markerLayer.clearLayers();

    var enrich = window.hubEnrichEventCoords
      ? window.hubEnrichEventCoords(events || [])
      : Promise.resolve();

    enrich.then(function () {
      if (token !== renderToken) return;

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
        var href = 'event.html?id=' + encodeURIComponent(ev.id);
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
          escapeHtml(href) +
          '">View event</a></div>';
        markerLayer.addLayer(L.marker(coords).bindPopup(popup));
      });

      if (!placed) {
        map.setView([54.5, -2.5], 6);
        if (skipped && mapPanel) {
          mapPanel.setAttribute(
            'data-map-hint',
            'Add a Postcode column in Airtable (or include it in Location) to place pins.'
          );
        }
        return;
      }
      mapPanel && mapPanel.removeAttribute('data-map-hint');
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
