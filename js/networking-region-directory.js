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
