/**
 * Curated UK networking region directory — browser allow-list.
 * Keep in sync with api/_lib/networking-regions.js.
 */
(function (global) {
  var REGIONS = {
    'central-london': { name: 'Central London', location: 'Central London' },
    'north-london': { name: 'North London', location: 'North London' },
    'south-london': { name: 'South London', location: 'South London' },
    'east-london': { name: 'East London', location: 'East London' },
    'west-london': { name: 'West London', location: 'West London' },
    manchester: { name: 'Manchester', location: 'Manchester' },
    birmingham: { name: 'Birmingham', location: 'Birmingham' },
    glasgow: { name: 'Glasgow', location: 'Glasgow' },
    edinburgh: { name: 'Edinburgh', location: 'Edinburgh' },
    leeds: { name: 'Leeds', location: 'Leeds' },
    liverpool: { name: 'Liverpool', location: 'Liverpool' },
    newcastle: { name: 'Newcastle', location: 'Newcastle' },
    bristol: { name: 'Bristol', location: 'Bristol' },
    sheffield: { name: 'Sheffield', location: 'Sheffield' },
    nottingham: { name: 'Nottingham', location: 'Nottingham' },
    cardiff: { name: 'Cardiff', location: 'Cardiff' },
    brighton: { name: 'Brighton', location: 'Brighton' },
    cambridge: { name: 'Cambridge', location: 'Cambridge' },
    oxford: { name: 'Oxford', location: 'Oxford' },
    chester: { name: 'Chester', location: 'Chester' },
    belfast: { name: 'Belfast', location: 'Belfast' },
    reading: { name: 'Reading', location: 'Reading' },
    leicester: { name: 'Leicester', location: 'Leicester' },
    bournemouth: { name: 'Bournemouth', location: 'Bournemouth' },
  };

  var ALIASES = {
    london: 'central-london',
  };

  function normalize(raw) {
    return String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  function getRegion(slug) {
    var key = normalize(slug);
    return REGIONS[key] || null;
  }

  function resolveSlug(query) {
    var q = normalize(query);
    if (!q) return '';

    if (ALIASES[q]) return ALIASES[q];

    var slug;
    for (slug in REGIONS) {
      if (!Object.prototype.hasOwnProperty.call(REGIONS, slug)) continue;
      if (normalize(REGIONS[slug].name) === q) return slug;
    }
    return '';
  }

  function search(query, limit) {
    var q = normalize(query);
    if (!q || q.length < 2) return [];

    var max = typeof limit === 'number' ? limit : 8;
    var matches = [];
    var slug;

    for (slug in REGIONS) {
      if (!Object.prototype.hasOwnProperty.call(REGIONS, slug)) continue;
      var region = REGIONS[slug];
      var name = normalize(region.name);
      if (name.indexOf(q) === 0 || name.indexOf(q) !== -1 || q.indexOf(name) !== -1) {
        matches.push({ slug: slug, name: region.name });
      }
    }

    matches.sort(function (a, b) {
      var aName = normalize(a.name);
      var bName = normalize(b.name);
      if (aName === q && bName !== q) return -1;
      if (bName === q && aName !== q) return 1;
      if (aName.indexOf(q) === 0 && bName.indexOf(q) !== 0) return -1;
      if (bName.indexOf(q) === 0 && aName.indexOf(q) !== 0) return 1;
      return a.name.localeCompare(b.name);
    });

    return matches.slice(0, max);
  }

  function regionPath(slug) {
    return '/networking/' + encodeURIComponent(String(slug || '').trim());
  }

  global.HUB_NETWORKING_REGIONS = REGIONS;
  global.HUB_resolveNetworkingRegionSlug = resolveSlug;
  global.HUB_searchNetworkingRegions = search;
  global.HUB_networkingRegionPath = regionPath;
  global.HUB_getNetworkingRegion = getRegion;
})(typeof window !== 'undefined' ? window : globalThis);

/**
 * Dynamic "Near you" chip on events browse — links to nearest /networking/:slug.
 */
(function () {
  var CHIP_ID = 'home-location-chip-near-you';
  var resolvedSlug = '';

  function regionPath(slug) {
    return window.HUB_networkingRegionPath
      ? window.HUB_networkingRegionPath(slug)
      : '/networking/' + encodeURIComponent(String(slug || '').trim());
  }

  function regionLabel(slug) {
    if (window.HUB_getNetworkingRegion) {
      var meta = window.HUB_getNetworkingRegion(slug);
      if (meta && meta.name) return meta.name;
    }
    return String(slug || '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, function (c) {
        return c.toUpperCase();
      });
  }

  function slugFromText(text) {
    return window.hubNetworkingRegionSlugFromInput
      ? window.hubNetworkingRegionSlugFromInput(text)
      : '';
  }

  function nearestSlugFromCoords(lat, lng) {
    return fetch(
      'https://api.postcodes.io/postcodes?lon=' +
        encodeURIComponent(lng) +
        '&lat=' +
        encodeURIComponent(lat) +
        '&limit=1'
    )
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data.status !== 200 || !data.result || !data.result.length) return '';
        var row = data.result[0];
        return slugFromText(row.postcode || row.outcode || '');
      })
      .catch(function () {
        return '';
      });
  }

  function ensureChip() {
    var track = document.querySelector('#networking-location-directory .home-locations-track');
    if (!track) return null;
    var chip = document.getElementById(CHIP_ID);
    if (chip) return chip;

    chip = document.createElement('a');
    chip.id = CHIP_ID;
    chip.className = 'home-location-chip home-location-chip--near-you';
    chip.setAttribute('role', 'listitem');
    chip.hidden = true;
    chip.innerHTML =
      '<span class="home-location-chip-icon" aria-hidden="true"></span>' +
      '<span class="home-location-chip-name home-location-chip-name--stacked">' +
      '<span class="home-location-chip-name-line home-location-chip-kicker">Near you</span>' +
      '<span class="home-location-chip-name-line home-location-chip-city" id="home-location-chip-near-you-city"></span>' +
      '</span>';

    var online = track.querySelector('.home-location-chip--online');
    if (online) {
      track.insertBefore(chip, online.nextSibling);
    } else {
      track.insertBefore(chip, track.firstChild);
    }
    return chip;
  }

  function showNearYouChip(slug) {
    if (!slug) return;
    if (window.hubRegionalLanding && window.hubRegionalLanding.slug === slug) return;
    if (window.HUB_getNetworkingRegion && !window.HUB_getNetworkingRegion(slug)) return;

    var chip = ensureChip();
    if (!chip) return;

    var label = regionLabel(slug);
    resolvedSlug = slug;
    chip.href = regionPath(slug);
    chip.setAttribute('data-region', slug);
    chip.setAttribute('aria-label', 'Browse networking near you in ' + label);
    chip.setAttribute('title', label);

    var cityEl = chip.querySelector('#home-location-chip-near-you-city');
    if (cityEl) cityEl.textContent = label;

    chip.hidden = false;
    if (window.HUB_initLocationChipElement) window.HUB_initLocationChipElement(chip);
  }

  function hideNearYouChip() {
    var chip = document.getElementById(CHIP_ID);
    if (chip) chip.hidden = true;
    resolvedSlug = '';
  }

  function applySlug(slug) {
    if (!slug || slug === resolvedSlug) return;
    showNearYouChip(slug);
  }

  function initNearYouChip() {
    if (window.hubRegionalLanding && window.hubRegionalLanding.slug) {
      hideNearYouChip();
      return;
    }

    function fallbackProfile() {
      var profilePromise = window.hubLoadProfileLocation
        ? window.hubLoadProfileLocation()
        : Promise.resolve(window.hubProfileLocation || '');

      profilePromise.then(function (loc) {
        var slug = slugFromText(loc);
        if (slug) applySlug(slug);
      });
    }

    function fromCoords(lat, lng) {
      nearestSlugFromCoords(lat, lng).then(function (slug) {
        if (slug) applySlug(slug);
        else fallbackProfile();
      });
    }

    if (window.hubUserCoords && window.hubUserCoords.length === 2) {
      fromCoords(window.hubUserCoords[0], window.hubUserCoords[1]);
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          fromCoords(pos.coords.latitude, pos.coords.longitude);
        },
        function () {
          fallbackProfile();
        },
        { maximumAge: 600000, timeout: 8000, enableHighAccuracy: false }
      );
      return;
    }

    fallbackProfile();
  }

  window.HUB_refreshNearYouChip = initNearYouChip;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNearYouChip);
  } else {
    initNearYouChip();
  }
})();
