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

  var locationQueryCache = Object.create(null);

  /** Geocode a postcode or place name (postcodes.io). */
  window.hubGeocodeLocationQuery = function (input) {
    var raw = String(input || '').trim();
    if (!raw) return Promise.resolve(null);
    if (locationQueryCache[raw] !== undefined) {
      return Promise.resolve(locationQueryCache[raw]);
    }

    return window.hubGeocodePostcode(raw).then(function (coords) {
      if (coords) {
        locationQueryCache[raw] = coords;
        return coords;
      }
      return fetch(
        'https://api.postcodes.io/postcodes?q=' + encodeURIComponent(raw) + '&limit=1'
      )
        .then(function (res) {
          return res.json();
        })
        .then(function (data) {
          if (data.status === 200 && data.result && data.result.length && data.result[0]) {
            var row = data.result[0];
            var c = [row.latitude, row.longitude];
            locationQueryCache[raw] = c;
            return c;
          }
          locationQueryCache[raw] = null;
          return null;
        })
        .catch(function () {
          locationQueryCache[raw] = null;
          return null;
        });
    });
  };

  window.hubLocationFilterCoords = null;

  var placeExpandCache = Object.create(null);

  /** Static town → county/region synonyms when the places API is slow or offline. */
  var PLACE_EXPAND_FALLBACKS = {
    ripon: ['north yorkshire', 'yorkshire', 'hg4'],
    harrogate: ['north yorkshire', 'yorkshire', 'hg1', 'hg2', 'hg3'],
    knaresborough: ['north yorkshire', 'yorkshire', 'hg5'],
    york: ['north yorkshire', 'yorkshire', 'yo1', 'yo10', 'yo24', 'yo31'],
    scarborough: ['north yorkshire', 'yorkshire', 'yo11', 'yo12'],
    whitby: ['north yorkshire', 'yorkshire', 'yo21', 'yo22'],
    selby: ['north yorkshire', 'yorkshire', 'yo8'],
    leeds: ['west yorkshire', 'yorkshire', 'ls1'],
    bradford: ['west yorkshire', 'yorkshire', 'bd1'],
    halifax: ['west yorkshire', 'yorkshire', 'hx1'],
    huddersfield: ['west yorkshire', 'yorkshire', 'hd1'],
    sheffield: ['south yorkshire', 'yorkshire', 's1'],
    doncaster: ['south yorkshire', 'yorkshire', 'dn1'],
    barnsley: ['south yorkshire', 'yorkshire', 's70'],
    manchester: ['greater manchester', 'north west'],
    liverpool: ['merseyside', 'north west'],
    newcastle: ['tyne and wear', 'north east'],
    durham: ['county durham', 'north east'],
  };

  function uniqueLowerTerms(list) {
    var out = [];
    var seen = Object.create(null);
    (list || []).forEach(function (term) {
      var t = String(term || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
      if (!t || seen[t]) return;
      seen[t] = true;
      out.push(t);
    });
    return out;
  }

  /**
   * Expand a city/town query into related place terms (county, region, outcode)
   * so "Ripon" also matches listings labelled "North Yorkshire".
   */
  window.hubExpandLocationQueryTerms = function (input) {
    var raw = String(input || '').trim();
    if (!raw) return Promise.resolve([]);
    var key = raw.toLowerCase();
    if (placeExpandCache[key] !== undefined) {
      return Promise.resolve(placeExpandCache[key]);
    }

    var fallback = uniqueLowerTerms([key].concat(PLACE_EXPAND_FALLBACKS[key] || []));
    if (raw.length < 3) {
      placeExpandCache[key] = fallback;
      return Promise.resolve(fallback);
    }

    /* Seed cache with local synonyms so Ripon → North Yorkshire works immediately. */
    if (PLACE_EXPAND_FALLBACKS[key] && placeExpandCache[key] === undefined) {
      placeExpandCache[key] = fallback;
    }

    var pending = fetch('https://api.postcodes.io/places?q=' + encodeURIComponent(raw) + '&limit=5')
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        var terms = [key];
        var rows = (data && data.result) || [];
        var needle = key.replace(/[^a-z0-9]+/g, '');
        rows.forEach(function (row) {
          if (!row) return;
          var name = String(row.name_1 || '')
            .trim()
            .toLowerCase();
          var nameKey = name.replace(/[^a-z0-9]+/g, '');
          /* Prefer exact / prefix matches so short queries do not expand via unrelated places. */
          if (nameKey && nameKey !== needle && nameKey.indexOf(needle) !== 0 && needle.indexOf(nameKey) !== 0) {
            return;
          }
          terms.push(name);
          terms.push(row.county_unitary);
          terms.push(row.district_borough);
          terms.push(row.region);
          terms.push(row.outcode);
        });
        var merged = uniqueLowerTerms(terms.concat(PLACE_EXPAND_FALLBACKS[key] || []));
        placeExpandCache[key] = merged;
        return merged;
      })
      .catch(function () {
        placeExpandCache[key] = fallback;
        return fallback;
      });

    if (placeExpandCache[key] !== undefined) {
      return Promise.resolve(placeExpandCache[key]);
    }
    return pending;
  };
})();
