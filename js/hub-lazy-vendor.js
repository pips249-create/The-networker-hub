/**
 * Lazy-load heavy third-party assets (Leaflet, Flatpickr) on demand.
 */
(function (global) {
  var loading = Object.create(null);

  function hasStylesheet(href) {
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < links.length; i++) {
      if (String(links[i].href || '').indexOf(href) !== -1) return true;
    }
    return false;
  }

  function loadStyle(href) {
    if (hasStylesheet(href)) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = function () {
        resolve();
      };
      link.onerror = function () {
        reject(new Error('Failed to load stylesheet'));
      };
      document.head.appendChild(link);
    });
  }

  function loadScript(src, testFn) {
    if (typeof testFn === 'function' && testFn()) return Promise.resolve();
    if (loading[src]) return loading[src];
    loading[src] = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.crossOrigin = 'anonymous';
      script.onload = function () {
        resolve();
      };
      script.onerror = function () {
        delete loading[src];
        reject(new Error('Failed to load script'));
      };
      document.head.appendChild(script);
    });
    return loading[src];
  }

  function hubLoadLeaflet() {
    return Promise.all([
      loadStyle('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'),
      loadStyle('https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css'),
      loadStyle('https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css'),
      loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', function () {
        return !!global.L;
      }),
      loadScript(
        'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js',
        function () {
          return !!(global.L && global.L.markerClusterGroup);
        }
      ),
    ]);
  }

  function hubLoadFlatpickr() {
    // Must use unpkg — site CSP allows unpkg.com, not cdn.jsdelivr.net.
    return Promise.all([
      loadStyle('https://unpkg.com/flatpickr@4.6.13/dist/flatpickr.min.css'),
      loadScript('https://unpkg.com/flatpickr@4.6.13/dist/flatpickr.min.js', function () {
        return !!global.flatpickr;
      }),
    ]);
  }

  function hubEnsureLeafletReady(callback) {
    var run = function () {
      if (typeof callback === 'function') callback();
    };
    if (global.L) {
      run();
      return Promise.resolve();
    }
    return hubLoadLeaflet().then(run);
  }

  global.hubLoadLeaflet = hubLoadLeaflet;
  global.hubLoadFlatpickr = hubLoadFlatpickr;
  global.hubEnsureLeafletReady = hubEnsureLeafletReady;
})(window);
