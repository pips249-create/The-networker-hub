/**
 * Leaflet map view for filtered events (UK).
 */
(function () {
  var mapPanel = document.getElementById('events-map-panel');
  var listingsView = document.getElementById('listings-view');
  var mapBtn = document.getElementById('map-view-btn');
  var mapLabel = document.getElementById('map-view-label');
  var spotlightRow = document.querySelector('.spotlight-sponsor-row');

  var map = null;
  var markerLayer = null;
  var mapReady = false;
  var isMapView = false;

  var UK_CITIES = {
    london: [51.5074, -0.1278],
    manchester: [53.4808, -2.2426],
    birmingham: [52.4862, -1.8904],
    leeds: [53.8008, -1.5491],
    glasgow: [55.8642, -4.2518],
    edinburgh: [55.9533, -3.1883],
    bristol: [51.4545, -2.5879],
    liverpool: [53.4084, -2.9916],
    sheffield: [53.3811, -1.4701],
    cambridge: [52.2053, 0.1218],
    oxford: [51.752, -1.2577],
    cardiff: [51.4816, -3.1791],
    belfast: [54.5973, -5.9301],
    nottingham: [52.9548, -1.1581],
    newcastle: [54.9783, -1.6178],
    brighton: [50.8225, -0.1372],
    reading: [51.4543, -0.9781],
    coventry: [52.4068, -1.5197],
    leicester: [52.6369, -1.1398],
    southampton: [50.9097, -1.4044],
    plymouth: [50.3755, -4.1427],
    aberdeen: [57.1497, -2.0943],
    york: [53.959, -1.0815],
    bath: [51.3811, -2.359],
    exeter: [50.7184, -3.5339],
  };

  function jitterFromId(id, coords) {
    var h = 0;
    var s = String(id || '');
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return [
      coords[0] + ((h % 100) - 50) * 0.0001,
      coords[1] + (((h >> 8) % 100) - 50) * 0.0001,
    ];
  }

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function coordsForEvent(ev) {
    if (ev.lat != null && ev.lng != null && Number.isFinite(ev.lat) && Number.isFinite(ev.lng)) {
      return [ev.lat, ev.lng];
    }
    if (ev.formatSlug === 'online') return null;

    var hay = [ev.location, ev.postcode, ev.venue].filter(Boolean).join(' ').toLowerCase();
    if (hay.includes('online') && !hay.match(/\b(london|manchester)\b/)) return null;

    var keys = Object.keys(UK_CITIES);
    for (var i = 0; i < keys.length; i++) {
      if (hay.indexOf(keys[i]) !== -1) {
        return jitterFromId(ev.id, UK_CITIES[keys[i]].slice());
      }
    }

    var pc = (ev.postcode || '').trim().toUpperCase();
    if (pc.length >= 2) {
      var area = pc.slice(0, 2).toLowerCase();
      var areaMap = {
        ec: UK_CITIES.london,
        wc: UK_CITIES.london,
        sw: UK_CITIES.london,
        se: UK_CITIES.london,
        nw: UK_CITIES.london,
        n1: UK_CITIES.london,
        e1: UK_CITIES.london,
        w1: UK_CITIES.london,
        m1: UK_CITIES.manchester,
        m2: UK_CITIES.manchester,
        b1: UK_CITIES.birmingham,
        ls: UK_CITIES.leeds,
        eh: UK_CITIES.edinburgh,
        g1: UK_CITIES.glasgow,
      };
      var prefix = pc.replace(/[^A-Z]/g, '').slice(0, 2).toLowerCase();
      if (areaMap[prefix]) return areaMap[prefix].slice();
      if (areaMap[area]) return areaMap[area].slice();
    }

    return [54.5, -3.5];
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
    if (mapPanel) {
      mapPanel.hidden = !mapMode;
    }
    if (listingsView) {
      listingsView.hidden = mapMode;
    }
    if (spotlightRow) {
      spotlightRow.style.display = mapMode ? 'none' : '';
    }
    if (mapBtn) {
      mapBtn.setAttribute('aria-pressed', mapMode ? 'true' : 'false');
    }
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

    markerLayer.clearLayers();
    var bounds = [];
    var placed = 0;

    (events || []).forEach(function (ev) {
      var coords = coordsForEvent(ev);
      if (!coords) return;
      bounds.push(coords);
      placed++;
      var href = 'event.html?id=' + encodeURIComponent(ev.id);
      var popup =
        '<div class="map-popup">' +
        '<strong>' +
        escapeHtml(ev.title) +
        '</strong><br>' +
        escapeHtml(ev.dateLine || ev.date || '') +
        '<br><span>' +
        escapeHtml(ev.price) +
        '</span><br>' +
        '<a href="' +
        escapeHtml(href) +
        '">View event</a></div>';
      var marker = L.marker(coords).bindPopup(popup);
      markerLayer.addLayer(marker);
    });

    if (placed === 0) {
      map.setView([54.5, -2.5], 6);
      return;
    }
    if (bounds.length === 1) {
      map.setView(bounds[0], 12);
    } else {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }
  }

  window.hubRefreshMap = function (filtered) {
    if (!isMapView) return;
    renderMarkers(filtered || []);
  };
})();
