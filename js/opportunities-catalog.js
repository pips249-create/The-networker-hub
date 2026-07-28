/**
 * Opportunities listing catalog — shared by browse and detail pages.
 */
(function () {
  var TYPE_LABELS = {
    franchise: 'Franchise',
    'side-hustle': 'Side hustle',
    partnership: 'Partnership',
    networking: 'Networking',
    distributorship: 'Distributorship',
    'business-opportunity': 'Business opportunity',
  };

  var MLM_ASSET_SLUGS = {
    'VitaBlend UK': 'vitablend-uk',
    'GlowHaus Collective': 'glowhaus-collective',
    'PureEssence Oils': 'pureessence-oils',
    'SlimPath Nutrition': 'slimpath-nutrition',
    'Scent & Flame Co': 'scent-flame-co',
    'GreenLeaf CBD': 'greenleaf-cbd',
    'EcoShine Home': 'ecoshine-home',
    'LuxeLinks Jewellery': 'luxelinks-jewellery',
    'GlobeTrek Travel Club': 'globetrek-travel',
    'Bean & Boost Coffee': 'bean-boost-coffee',
    'MindFuel Academy': 'mindfuel-academy',
    'ActiveLife Sports Nutrition': 'activelife-sports',
  };

  function seedAssetSlug(seed) {
    if (seed.assetSlug) return String(seed.assetSlug).trim();
    return MLM_ASSET_SLUGS[seed.host] || '';
  }

  function seedLogoUrl(slug) {
    return slug ? '/assets/opportunities/logos/' + slug + '.svg' : '';
  }

  function seedCoverUrl(slug) {
    return slug ? '/assets/opportunities/covers/' + slug + '.svg' : '';
  }

  var SEED_LISTINGS = [];
  var loadedCatalog = [];

  var REGIONS = [
    'Yorkshire',
    'Manchester',
    'Birmingham',
    'London',
    'Bristol',
    'Scotland',
    'Wales',
    'Remote',
    'UK-wide',
    'Leeds',
    'Liverpool',
    'Newcastle',
  ];

  var THUMB_BY_TYPE = {
    franchise: { emoji: '🏢', gradient: 'linear-gradient(135deg,#fdf6e3,#f5e0a0)' },
    'side-hustle': { emoji: '💡', gradient: 'linear-gradient(135deg,#e6f7f5,#b2e8e2)' },
    partnership: { emoji: '🤝', gradient: 'linear-gradient(135deg,#eff6ff,#bfdbfe)' },
    networking: { emoji: '🔗', gradient: 'linear-gradient(135deg,#fdf4ff,#e9d5ff)' },
    distributorship: { emoji: '📦', gradient: 'linear-gradient(135deg,#fff7ed,#fed7aa)' },
    'business-opportunity': { emoji: '✦', gradient: 'linear-gradient(135deg,#ecfdf5,#a7f3d0)' },
  };

  var THUMB_BY_KEYWORD = [
    { match: /clean/i, emoji: '🧹', gradient: 'linear-gradient(135deg,#fdf6e3,#f5e0a0)' },
    { match: /food|kiosk|coffee|brew/i, emoji: '🥗', gradient: 'linear-gradient(135deg,#f0fdf4,#bbf7d0)' },
    { match: /photo|web|digital/i, emoji: '📸', gradient: 'linear-gradient(135deg,#e6f7f5,#b2e8e2)' },
    { match: /dog|groom|pet|paw/i, emoji: '🐾', gradient: 'linear-gradient(135deg,#fdf4ff,#e9d5ff)' },
    { match: /book|ledger|finance/i, emoji: '📊', gradient: 'linear-gradient(135deg,#f8fafc,#e2e8f0)' },
    { match: /gym|fit|fitness/i, emoji: '🏋️', gradient: 'linear-gradient(135deg,#ecfdf5,#a7f3d0)' },
    { match: /network/i, emoji: '🔗', gradient: 'linear-gradient(135deg,#fdf4ff,#e9d5ff)' },
    { match: /skin|beauty|tropic|cosmetic|wellness/i, emoji: '✨', gradient: 'linear-gradient(135deg,#fdf4ff,#fbcfe8)' },
    { match: /mlm|network marketing|consultant|ambassador|direct sales/i, emoji: '🌐', gradient: 'linear-gradient(135deg,#eff6ff,#c7d2fe)' },
  ];

  var CATEGORY_KEYWORDS = {
    cleaning: /clean/i,
    food: /food|kiosk|coffee|brew|drink/i,
    tech: /web|digital|photo|software|tech/i,
    health: /gym|fit|fitness|health/i,
    beauty: /skin|beauty|tropic|cosmetic|wellness/i,
    property: /property|maintenance|handyman/i,
    education: /course|coach|training|academy|education/i,
    pets: /dog|groom|pet|paw|animal/i,
    finance: /book|ledger|finance|account/i,
    mlm: /mlm|multi[\s-]?level|network marketing|direct sales|independent consultant|team build|downline|upline|ambassador/i,
    guaranteed_income: /guaranteed\s+(income|earnings|profit|return)|passive income|financial freedom|unlimited income|quit your job/i,
    unregulated_investment: /crypto(?:currency)?|forex|binary option|unregulated investment|high[\s-]?yield|hyip|ponzi/i,
  };

  var CITY_SLUG_BY_NAME = {
    'central london': 'central-london',
    'north london': 'north-london',
    'south london': 'south-london',
    'east london': 'east-london',
    'west london': 'west-london',
    manchester: 'manchester',
    birmingham: 'birmingham',
    glasgow: 'glasgow',
    edinburgh: 'edinburgh',
    leeds: 'leeds',
    liverpool: 'liverpool',
    newcastle: 'newcastle',
    bristol: 'bristol',
    sheffield: 'sheffield',
    nottingham: 'nottingham',
    cardiff: 'cardiff',
    brighton: 'brighton',
    cambridge: 'cambridge',
    oxford: 'oxford',
    chester: 'chester',
  };

  var UMBRELLA_TO_SLUGS = {
    yorkshire: ['leeds', 'sheffield'],
    'north england': ['manchester', 'liverpool', 'newcastle', 'leeds', 'sheffield'],
    'north west': ['manchester', 'liverpool'],
    north: ['manchester', 'liverpool', 'newcastle', 'leeds', 'sheffield'],
    midlands: ['birmingham', 'nottingham'],
    'west midlands': ['birmingham'],
    'south england': [
      'bristol',
      'brighton',
      'oxford',
      'cambridge',
      'central-london',
      'north-london',
      'south-london',
      'east-london',
      'west-london',
    ],
    scotland: ['glasgow', 'edinburgh'],
    wales: ['cardiff'],
    london: ['central-london', 'north-london', 'south-london', 'east-london', 'west-london'],
  };

  function metaVal(meta, keyRe) {
    for (var i = 0; i < (meta || []).length; i++) {
      if (keyRe.test(meta[i].key)) return String(meta[i].val || '');
    }
    return '';
  }

  function parseInvestmentAmount(meta) {
    var raw = metaVal(meta, /^investment$/i);
    if (!raw) return null;
    var num = parseInt(raw.replace(/[^0-9]/g, ''), 10);
    return isNaN(num) ? null : num;
  }

  function parseInvestmentIncludes(raw) {
    return String(raw || '')
      .split(/\r?\n|;|•|·/)
      .map(function (s) {
        return s.replace(/^[\s\-*]+/, '').trim();
      })
      .filter(Boolean)
      .slice(0, 8);
  }

  function isScarcityMeta(key, val) {
    var k = String(key || '').toLowerCase();
    var v = String(val || '').toLowerCase();
    return (
      /left|spaces?|vans?|territor|slots?|available|remaining/.test(k) ||
      (/\d/.test(v) && /\bleft\b/.test(v))
    );
  }

  function inferCategory(item) {
    var text = (item.title + ' ' + item.desc + ' ' + item.host).toLowerCase();
    var keys = Object.keys(CATEGORY_KEYWORDS);
    for (var i = 0; i < keys.length; i++) {
      if (CATEGORY_KEYWORDS[keys[i]].test(text)) return keys[i];
    }
    return 'general';
  }

  function thumbFor(item) {
    var text = item.title + ' ' + item.desc;
    for (var i = 0; i < THUMB_BY_KEYWORD.length; i++) {
      if (THUMB_BY_KEYWORD[i].match.test(text)) return THUMB_BY_KEYWORD[i];
    }
    return THUMB_BY_TYPE[item.type] || THUMB_BY_TYPE.franchise;
  }

  function enrichFilterTags(item) {
    var tags = (item.tags || []).slice();
    var inv = item.investAmount;
    if (inv !== null && inv !== undefined) {
      if (inv <= 2500) tags.push('low-invest');
      else if (inv <= 10000) tags.push('mid-invest');
      else tags.push('high-invest');
    }
    var loc = metaVal(item.meta, /^location$/i).toLowerCase();
    var searchBlob = (loc + ' ' + item.title + ' ' + item.desc).toLowerCase();
    if (/remote|online/.test(searchBlob)) tags.push('remote');
    if (/yorkshire|leeds/.test(searchBlob)) tags.push('yorkshire');
    if (/north|manchester|liverpool|newcastle/.test(searchBlob)) tags.push('north');
    if (/midlands|birmingham|west midlands/.test(searchBlob)) tags.push('midlands');
    if (/bristol|south west|southwest|south england/.test(searchBlob)) tags.push('south');
    if (/london/.test(searchBlob)) tags.push('london');
    if (/uk-wide|uk wide|your area|various/.test(searchBlob)) tags.push('uk-wide');
    var comm = metaVal(item.meta, /^commitment$/i).toLowerCase();
    if (/full/.test(comm)) tags.push('full-time');
    if (/part|flex/.test(comm)) tags.push('part-time');
    if (/event/.test(comm)) tags.push('event-based');
    if (item.category && item.category !== 'general') tags.push('cat-' + item.category);
    item.filterTags = tags;
    return deriveCitySlugs(item);
  }

  function deriveCitySlugs(item) {
    var loc = metaVal(item.meta, /^location$/i) || metaVal(item.meta, /territor/i);
    var blob = [loc, item.title, item.desc, (item.tags || []).join(' ')]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    var slugs = [];
    var seen = {};

    function add(slug) {
      if (!slug || seen[slug]) return;
      seen[slug] = true;
      slugs.push(slug);
    }

    if (/remote|online|uk-wide|uk wide|nationwide|anywhere|work from home|wfh|your area|various territor/.test(blob)) {
      item.matchesAllCities = true;
      item.citySlugs = [];
      return item;
    }

    Object.keys(CITY_SLUG_BY_NAME).forEach(function (name) {
      if (blob.indexOf(name) !== -1) add(CITY_SLUG_BY_NAME[name]);
    });

    Object.keys(UMBRELLA_TO_SLUGS)
      .sort(function (a, b) {
        return b.length - a.length;
      })
      .forEach(function (phrase) {
        if (phrase === 'london') return;
        if (blob.indexOf(phrase) !== -1) {
          UMBRELLA_TO_SLUGS[phrase].forEach(add);
        }
      });

    if (/tyne/.test(blob)) add('newcastle');
    if (/greater manchester/.test(blob)) add('manchester');

    item.citySlugs = slugs;
    item.matchesAllCities = false;
    return item;
  }

  function locationLabel(item) {
    var loc = metaVal(item.meta, /^location$/i);
    if (!loc) loc = metaVal(item.meta, /territor/i);
    if (!loc) return 'UK';
    if (/remote/i.test(loc)) return 'Remote — UK';
    return loc;
  }

  function formatMetaDisplayValue(key, val) {
    var v = String(val || '').trim();
    if (!v || v === '—') return v;
    if (/^£/.test(v)) return v;
    var k = String(key || '').toLowerCase();
    if (/^investment/.test(k)) {
      if (/%/.test(v)) return v;
      if (/\d/.test(v)) return '£' + v;
    }
    return v;
  }

  function cardDisplayMeta(item) {
    var meta = item.meta || [];
    var investment = null;
    var scarcity = null;
    var location = null;
    var extra = [];

    meta.forEach(function (m) {
      if (/^investment includes$/i.test(m.key)) return;
      if (/^companies house$/i.test(m.key)) return;
      if (/^(return(\s+est\.?)?|earnings|commission|revenue|income|profit)$/i.test(m.key)) return;
      if (/^investment$/i.test(m.key)) investment = m;
      else if (isScarcityMeta(m.key, m.val)) scarcity = scarcity || m;
      else if (/^location$/i.test(m.key)) location = location || m;
      else extra.push(m);
    });

    var row3 = scarcity || location || extra[0] || null;
    var row4 = null;
    if (scarcity && location) row4 = location;
    else if (extra.length) row4 = extra[0];

    var commitment = metaVal(meta, /^commitment$/i);
    if (!row4 && commitment) row4 = { key: 'Commitment', val: commitment };

    return [investment, row3, row4].filter(Boolean).slice(0, 4);
  }

  function buildSearchText(item) {
    return [item.title, item.host, item.desc, item.type, item.category]
      .concat(item.tags || [])
      .concat(item.filterTags || [])
      .concat((item.meta || []).map(function (m) {
        return m.key + ' ' + m.val;
      }))
      .join(' ')
      .toLowerCase();
  }

  function apiRowToSeed(row) {
    var slug = row.slug ? String(row.slug).trim() : '';
    if (!slug && row.title && window.HubPublicUrls && window.HubPublicUrls.slugifyTitle) {
      slug = window.HubPublicUrls.slugifyTitle(row.title);
    }
    return {
      id: row.id,
      slug: slug,
      type: row.type,
      tags: row.tags || [row.type],
      featured: Boolean(row.featured),
      host: row.host || '',
      hostInitials: row.hostInitials || '',
      hostColor: row.hostColor || '',
      title: row.title || '',
      desc: row.desc || '',
      about: row.about || [],
      meta: row.meta || [],
      category: row.category || 'general',
      contactEmail: row.contactEmail || '',
      imageUrl: row.imageUrl || '',
      logoUrl: row.logoUrl || '',
      claimable: Boolean(row.claimable),
    };
  }

  function normalizeListing(seed, index) {
    var item = Object.assign({}, seed);
    if (!item.id) item.id = 'opp-' + (index + 1);
    item.tags = (seed.tags || []).slice();
    item.meta = (seed.meta || []).map(function (m) {
      return { key: m.key, val: m.val };
    });
    item.about = (seed.about || []).slice();
    var assetSlug = seedAssetSlug(seed);
    item.logoUrl = String(seed.logoUrl || seedLogoUrl(assetSlug) || '').trim();
    item.imageUrl = String(seed.imageUrl || seedCoverUrl(assetSlug) || '').trim();
    item.investAmount = parseInvestmentAmount(item.meta);
    item.investmentIncludes = parseInvestmentIncludes(metaVal(item.meta, /^investment includes$/i));
    item.category = seed.category || inferCategory(item);
    item.thumb = thumbFor(item);
    item.locationLabel = locationLabel(item);
    item = enrichFilterTags(item);
    item.searchText = buildSearchText(item);
    return item;
  }

  function expandCatalog(seeds, count) {
    var out = [];
    for (var i = 0; i < count; i++) {
      var seed = seeds[i % seeds.length];
      var item = normalizeListing(seed, i);
      if (i >= seeds.length) {
        var region = REGIONS[i % REGIONS.length];
        item.title = seed.title.replace(/—.*/, '— ' + region);
        if (item.meta.length > 2) {
          item.meta[2] = { key: 'Location', val: region };
        }
        item.featured = i < 3;
        item.investAmount = parseInvestmentAmount(item.meta);
        item.locationLabel = locationLabel(item);
        item = enrichFilterTags(item);
        item.searchText = buildSearchText(item);
      }
      out.push(item);
    }
    return out;
  }

  function loadCatalog() {
    return loadedCatalog.slice();
  }

  function loadCatalogAsync() {
    return fetch('/api/opportunities', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        var data = result.data;
        if (!result.ok || !data || !data.ok || !Array.isArray(data.opportunities)) {
          return loadedCatalog.slice();
        }
        loadedCatalog = data.opportunities.map(function (row, i) {
          return normalizeListing(apiRowToSeed(row), i);
        });
        var seenIds = {};
        loadedCatalog = loadedCatalog.filter(function (item) {
          var id = String(item.id || '');
          if (!id || seenIds[id]) return false;
          seenIds[id] = true;
          return true;
        });
        return loadedCatalog.slice();
      })
      .catch(function () {
        return loadedCatalog.slice();
      });
  }

  function getBySlug(slug) {
    var key = String(slug || '').trim().toLowerCase();
    if (!key) return null;
    var catalog = loadCatalog();
    for (var i = 0; i < catalog.length; i++) {
      var item = catalog[i];
      if (String(item.slug || '').trim().toLowerCase() === key) return item;
      if (window.HubPublicUrls && window.HubPublicUrls.slugifyTitle) {
        var derived = window.HubPublicUrls.slugifyTitle(item.title);
        if (derived && derived === key) return item;
      }
    }
    return null;
  }

  function getById(id) {
    var key = String(id || '');
    if (!key) return null;
    var bySlug = getBySlug(key);
    if (bySlug) return bySlug;
    var catalog = loadCatalog();
    for (var i = 0; i < catalog.length; i++) {
      if (catalog[i].id === key) return catalog[i];
    }
    return null;
  }

  function matchesLookup(item, lookup) {
    var key = String(lookup || '').trim().toLowerCase();
    if (!key || !item) return false;
    if (String(item.id || '').toLowerCase() === key) return true;
    if (String(item.slug || '').trim().toLowerCase() === key) return true;
    if (window.HubPublicUrls && window.HubPublicUrls.slugifyTitle) {
      var derived = window.HubPublicUrls.slugifyTitle(item.title);
      if (derived && derived.toLowerCase() === key) return true;
    }
    return false;
  }

  function fetchOpportunityRecord(lookup) {
    return fetch('/api/opportunities?slug=' + encodeURIComponent(lookup), {
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        var data = result.data;
        if (result.ok && data && data.ok && data.opportunity) {
          return normalizeListing(apiRowToSeed(data.opportunity), 0);
        }
        return null;
      });
  }

  function fetchOpportunityFromCatalog(lookup) {
    return fetch('/api/opportunities', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        var data = result.data;
        if (!result.ok || !data || !data.ok || !Array.isArray(data.opportunities)) {
          return null;
        }
        for (var i = 0; i < data.opportunities.length; i++) {
          var row = data.opportunities[i];
          var item = normalizeListing(apiRowToSeed(row), i);
          if (matchesLookup(item, lookup)) return item;
        }
        return null;
      });
  }

  function fetchBySlugOrId(key) {
    var lookup = String(key || '').trim();
    if (!lookup) return Promise.resolve(null);
    var cached = getBySlug(lookup) || getById(lookup);
    if (cached) return Promise.resolve(cached);
    return fetchOpportunityRecord(lookup)
      .then(function (item) {
        if (item) return item;
        return fetchOpportunityFromCatalog(lookup);
      })
      .catch(function () {
        return null;
      });
  }

  function fetchById(id) {
    return fetchBySlugOrId(id);
  }

  function detailHref(item) {
    if (window.HubPublicUrls && window.HubPublicUrls.opportunityDetailHref) {
      return window.HubPublicUrls.opportunityDetailHref(item);
    }
    var id = typeof item === 'string' ? item : item && item.id;
    if (!id) return '/opportunities/';
    return '/opportunities/' + encodeURIComponent(id);
  }

  function typeClass(type) {
    var map = {
      'side-hustle': 'opp-type-sidehustle',
      partnership: 'opp-type-partnership',
      networking: 'opp-type-networking',
      distributorship: 'opp-type-distributorship',
      'business-opportunity': 'opp-type-business',
    };
    return map[type] || 'opp-type-franchise';
  }

  window.HubOpportunitiesCatalog = {
    TYPE_LABELS: TYPE_LABELS,
    SEED_LISTINGS: SEED_LISTINGS,
    buildSearchText: buildSearchText,
    normalizeListing: normalizeListing,
    expandCatalog: expandCatalog,
    loadCatalog: loadCatalog,
    loadCatalogAsync: loadCatalogAsync,
    getById: getById,
    getBySlug: getBySlug,
    fetchById: fetchById,
    fetchBySlugOrId: fetchBySlugOrId,
    apiRowToSeed: apiRowToSeed,
    detailHref: detailHref,
    typeClass: typeClass,
    cardDisplayMeta: cardDisplayMeta,
    formatMetaDisplayValue: formatMetaDisplayValue,
    isScarcityMeta: isScarcityMeta,
    parseInvestmentAmount: parseInvestmentAmount,
    parseInvestmentIncludes: parseInvestmentIncludes,
    CATEGORY_KEYWORDS: CATEGORY_KEYWORDS,
  };

  window.hubOpportunityDetailHref = detailHref;
})();
