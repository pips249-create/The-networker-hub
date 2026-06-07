/**
 * UK postcode geocoding via postcodes.io (cached).
 */
(function () {
  var cache = Object.create(null);
  var UK_POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;

  function normalizePostcode(pc) {
    return String(pc || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ' ');
  }

  function extractPostcode(ev) {
    if (ev.postcode) return normalizePostcode(ev.postcode);
    var hay = [ev.location, ev.venue].filter(Boolean).join(' ');
    var m = hay.match(UK_POSTCODE_RE);
    return m ? normalizePostcode(m[1]) : '';
  }

  function haversineMiles(lat1, lon1, lat2, lon2) {
    var R = 3958.8;
    var dLat = ((lat2 - lat1) * Math.PI) / 180;
    var dLon = ((lon2 - lon1) * Math.PI) / 180;
    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  window.hubExtractPostcode = extractPostcode;

  window.hubGeocodePostcode = function (pc) {
    var key = normalizePostcode(pc);
    if (!key) return Promise.resolve(null);
    if (cache[key] !== undefined) return Promise.resolve(cache[key]);

    return fetch(
      'https://api.postcodes.io/postcodes/' + encodeURIComponent(key.replace(/\s/g, ''))
    )
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data.status === 200 && data.result) {
          var coords = [data.result.latitude, data.result.longitude];
          cache[key] = coords;
          return coords;
        }
        return fetch(
          'https://api.postcodes.io/postcodes/' + encodeURIComponent(key)
        )
          .then(function (r) {
            return r.json();
          })
          .then(function (d2) {
            if (d2.status === 200 && d2.result) {
              var c2 = [d2.result.latitude, d2.result.longitude];
              cache[key] = c2;
              return c2;
            }
            cache[key] = null;
            return null;
          });
      })
      .catch(function () {
        cache[key] = null;
        return null;
      });
  };

  function enrichEventCoords(events) {
    var list = events || [];
    var needed = [];
    list.forEach(function (ev) {
      if (ev.mapLat != null && ev.mapLng != null) return;
      if (Number.isFinite(ev.lat) && Number.isFinite(ev.lng)) {
        ev.mapLat = ev.lat;
        ev.mapLng = ev.lng;
        return;
      }
      var pc = extractPostcode(ev);
      if (pc) needed.push({ ev: ev, pc: pc });
    });

    var byPc = {};
    needed.forEach(function (item) {
      if (!byPc[item.pc]) byPc[item.pc] = [];
      byPc[item.pc].push(item.ev);
    });

    var postcodes = Object.keys(byPc);
    if (!postcodes.length) return Promise.resolve();

    var batches = [];
    for (var i = 0; i < postcodes.length; i += 100) {
      batches.push(postcodes.slice(i, i + 100));
    }

    return batches
      .reduce(function (chain, chunk) {
        return chain.then(function () {
          var uncached = chunk.filter(function (pc) {
            return cache[pc] === undefined;
          });
          if (!uncached.length) return;
          var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
          var timer = controller
            ? setTimeout(function () {
                controller.abort();
              }, 8000)
            : null;
          return fetch('https://api.postcodes.io/postcodes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postcodes: uncached }),
            signal: controller ? controller.signal : undefined,
          })
            .then(function (res) {
              if (timer) clearTimeout(timer);
              return res.json();
            })
            .then(function (data) {
              (data.result || []).forEach(function (row) {
                var q = normalizePostcode(row.query || '');
                if (row.result) {
                  cache[q] = [row.result.latitude, row.result.longitude];
                } else {
                  cache[q] = null;
                }
              });
            })
            .catch(function () {
              if (timer) clearTimeout(timer);
              uncached.forEach(function (pc) {
                cache[pc] = null;
              });
            });
        });
      }, Promise.resolve())
      .then(function () {
        postcodes.forEach(function (pc) {
          var coords = cache[pc];
          if (!coords) return;
          byPc[pc].forEach(function (ev) {
            ev.mapLat = coords[0];
            ev.mapLng = coords[1];
          });
        });
      });
  }

  window.hubEnrichEventCoords = function (events, options) {
    options = options || {};
    var work = enrichEventCoords(events);
    if (options.noTimeout) return work;
    return Promise.race([
      work,
      new Promise(function (resolve) {
        setTimeout(resolve, 4000);
      }),
    ]);
  };

  window.hubDistanceMiles = haversineMiles;

  window.hubUserCoords = null;

  window.hubGeocodeUserPostcode = function (pc) {
    return window.hubGeocodePostcode(pc).then(function (coords) {
      window.hubUserCoords = coords;
      return coords;
    });
  };
})();
