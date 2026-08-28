/**
 * Shared listing field constants for organiser + admin opportunity forms.
 */
(function (global) {
  var COMMITMENT_OPTIONS = [
    '',
    'Full-time',
    'Part-time / Flexible',
    'Side hustle — few hours a week',
    'Flexible — no fixed hours',
    'Event-based',
    'Varies — discuss when you enquire',
  ];

  var COOKIE_WINDOW_OPTIONS = [
    '',
    '7 days',
    '14 days',
    '30 days',
    '60 days',
    '90 days',
    '180 days',
    '365 days',
    'Session only',
    'Lifetime',
    'Varies — ask when you enquire',
  ];

  var LISTING_REGION_BROAD = [
    { slug: 'uk-wide', label: 'UK-wide' },
    { slug: 'england', label: 'England' },
    { slug: 'scotland', label: 'Scotland' },
    { slug: 'wales', label: 'Wales' },
    { slug: 'northern-ireland', label: 'Northern Ireland' },
    { slug: 'remote', label: 'Remote / Online' },
    { slug: 'london', label: 'London (all areas)' },
  ];

  var LISTING_REGION_BROAD_SLUGS = new Set(
    LISTING_REGION_BROAD.map(function (row) {
      return row.slug;
    })
  );

  var LISTING_REGION_SPECIFIC_VALUE = '__specific__';

  var LISTING_REGION_GROUPS = [
    {
      label: 'Nationwide',
      regions: [
        { slug: 'uk-wide', label: 'UK-wide' },
        { slug: 'england', label: 'England' },
        { slug: 'scotland', label: 'Scotland' },
        { slug: 'wales', label: 'Wales' },
        { slug: 'northern-ireland', label: 'Northern Ireland' },
        { slug: 'remote', label: 'Remote / Online' },
      ],
    },
    {
      label: 'Counties',
      regions: [
        { slug: 'berkshire', label: 'Berkshire' },
        { slug: 'buckinghamshire', label: 'Buckinghamshire' },
        { slug: 'cambridgeshire', label: 'Cambridgeshire' },
        { slug: 'cheshire', label: 'Cheshire' },
        { slug: 'essex', label: 'Essex' },
        { slug: 'hampshire', label: 'Hampshire' },
        { slug: 'hertfordshire', label: 'Hertfordshire' },
        { slug: 'kent', label: 'Kent' },
        { slug: 'lancashire', label: 'Lancashire' },
        { slug: 'oxfordshire', label: 'Oxfordshire' },
        { slug: 'surrey', label: 'Surrey' },
        { slug: 'sussex', label: 'Sussex' },
      ],
    },
    {
      label: 'Wider regions',
      regions: [
        { slug: 'yorkshire', label: 'Yorkshire' },
        { slug: 'north-west', label: 'North West England' },
        { slug: 'north-east', label: 'North East England' },
        { slug: 'east-midlands', label: 'East Midlands' },
        { slug: 'west-midlands', label: 'West Midlands' },
        { slug: 'east-of-england', label: 'East of England' },
        { slug: 'south-east', label: 'South East England' },
        { slug: 'south-west', label: 'South West England' },
      ],
    },
    {
      label: 'London',
      regions: [
        { slug: 'london', label: 'London (all areas)' },
        { slug: 'central-london', label: 'Central London' },
        { slug: 'north-london', label: 'North London' },
        { slug: 'south-london', label: 'South London' },
        { slug: 'east-london', label: 'East London' },
        { slug: 'west-london', label: 'West London' },
      ],
    },
    {
      label: 'Cities & towns',
      regions: [
        { slug: 'belfast', label: 'Belfast' },
        { slug: 'birmingham', label: 'Birmingham' },
        { slug: 'bournemouth', label: 'Bournemouth' },
        { slug: 'brighton', label: 'Brighton' },
        { slug: 'bristol', label: 'Bristol' },
        { slug: 'cambridge', label: 'Cambridge' },
        { slug: 'cardiff', label: 'Cardiff' },
        { slug: 'chester', label: 'Chester' },
        { slug: 'edinburgh', label: 'Edinburgh' },
        { slug: 'glasgow', label: 'Glasgow' },
        { slug: 'leeds', label: 'Leeds' },
        { slug: 'leicester', label: 'Leicester' },
        { slug: 'liverpool', label: 'Liverpool' },
        { slug: 'manchester', label: 'Manchester' },
        { slug: 'newcastle', label: 'Newcastle' },
        { slug: 'nottingham', label: 'Nottingham' },
        { slug: 'oxford', label: 'Oxford' },
        { slug: 'reading', label: 'Reading' },
        { slug: 'sheffield', label: 'Sheffield' },
      ],
    },
  ];

  var LISTING_REGIONS = LISTING_REGION_GROUPS.reduce(function (acc, group) {
    group.regions.forEach(function (row) {
      acc.push(row);
    });
    return acc;
  }, []);

  var REGION_BY_SLUG = {};
  LISTING_REGIONS.forEach(function (row) {
    REGION_BY_SLUG[row.slug] = row;
  });

  function listingRegionBySlug(slug) {
    var key = String(slug || '').trim().toLowerCase();
    if (key === 'online') key = 'remote';
    return REGION_BY_SLUG[key] || null;
  }

  function formatListingLocation(region, detail) {
    var row = region || null;
    if (!row) return '';
    var extra = String(detail || '').trim();
    return extra ? row.label + ' — ' + extra : row.label;
  }

  function parseStoredListingLocation(stored, regionSlug) {
    var slugFromRow = String(regionSlug || '').trim().toLowerCase();
    if (slugFromRow === 'online') slugFromRow = 'remote';
    var text = String(stored || '').trim();
    if (slugFromRow && listingRegionBySlug(slugFromRow)) {
      var row = listingRegionBySlug(slugFromRow);
      if (text) {
        var norm = text.toLowerCase();
        var labelNorm = row.label.toLowerCase();
        if (norm.startsWith(labelNorm + ' — ') || norm.startsWith(labelNorm + ' - ')) {
          var sep = text.indexOf('—') >= 0 ? '—' : '-';
          return { slug: slugFromRow, detail: text.slice(text.indexOf(sep) + 1).trim() };
        }
      }
      return { slug: slugFromRow, detail: '' };
    }
    if (!text) return { slug: '', detail: '' };
    var norm = text.toLowerCase();
    if (/remote|online/.test(norm)) return { slug: 'remote', detail: '' };
    if (/uk.?wide|nationwide/.test(norm)) return { slug: 'uk-wide', detail: '' };
    if (/^england$/.test(norm)) return { slug: 'england', detail: '' };
    if (/^scotland$/.test(norm)) return { slug: 'scotland', detail: '' };
    if (/^wales$/.test(norm)) return { slug: 'wales', detail: '' };
    if (/northern ireland/.test(norm)) return { slug: 'northern-ireland', detail: '' };
    for (var i = 0; i < LISTING_REGIONS.length; i++) {
      var regionRow = LISTING_REGIONS[i];
      var regionLabelNorm = regionRow.label.toLowerCase();
      if (norm === regionLabelNorm || norm === regionRow.slug) return { slug: regionRow.slug, detail: '' };
      if (norm.startsWith(regionLabelNorm + ' — ') || norm.startsWith(regionLabelNorm + ' - ')) {
        return {
          slug: regionRow.slug,
          detail: text.slice(text.indexOf('—') + 1).trim() || text.slice(text.indexOf('-') + 1).trim(),
        };
      }
      if (norm.includes(regionRow.slug) || norm.includes(regionLabelNorm.split(' ')[0])) {
        return { slug: regionRow.slug, detail: '' };
      }
    }
    return { slug: '', detail: text };
  }

  function extraHighlightFromMeta(meta) {
    var usedKeys =
      /^(investment|investment includes|location|commitment|companies house|commission|what you promote|who it suits|cookie window)$/i;
    var list = Array.isArray(meta) ? meta : [];
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      var k = String((m && m.key) || '').trim();
      if (!k || usedKeys.test(k) || /^(return|earnings|revenue|income|profit)/i.test(k)) continue;
      return { key: k, val: String(m.val || '').trim() };
    }
    return { key: '', val: '' };
  }

  function cookieWindowFromMeta(meta) {
    var list = Array.isArray(meta) ? meta : [];
    for (var i = 0; i < list.length; i++) {
      var k = String((list[i] && list[i].key) || '').trim();
      if (/^cookie window$/i.test(k) || /^affiliate cookie/i.test(k)) {
        return String(list[i].val || '').trim();
      }
    }
    return '';
  }

  function formatAffiliateCookieDisplay(val) {
    var v = String(val || '').trim();
    if (!v) return '';
    if (/^varies/i.test(v)) return 'Affiliate cookie window varies — ask when you enquire.';
    if (/^session/i.test(v)) return 'Affiliate cookie window: session only.';
    if (/^lifetime/i.test(v)) return 'Affiliate cookie duration: lifetime tracking.';
    var dayMatch = v.match(/^(\d+)\s*days?$/i);
    if (dayMatch) return 'Affiliate cookie duration that lasts ' + dayMatch[1] + ' days.';
    return 'Affiliate cookie window: ' + v + '.';
  }

  function affiliateCookieShortLabel(val) {
    var v = String(val || '').trim();
    if (!v) return '';
    var dayMatch = v.match(/^(\d+)\s*days?$/i);
    if (dayMatch) return dayMatch[1] + '-day cookie';
    if (/^session/i.test(v)) return 'Session cookie';
    if (/^lifetime/i.test(v)) return 'Lifetime cookie';
    if (/^varies/i.test(v)) return 'Cookie varies';
    return v;
  }

  global.HubOpportunityListingConstants = {
    COMMITMENT_OPTIONS: COMMITMENT_OPTIONS,
    COOKIE_WINDOW_OPTIONS: COOKIE_WINDOW_OPTIONS,
    LISTING_REGION_BROAD: LISTING_REGION_BROAD,
    LISTING_REGION_BROAD_SLUGS: LISTING_REGION_BROAD_SLUGS,
    LISTING_REGION_SPECIFIC_VALUE: LISTING_REGION_SPECIFIC_VALUE,
    LISTING_REGION_GROUPS: LISTING_REGION_GROUPS,
    LISTING_REGIONS: LISTING_REGIONS,
    listingRegionBySlug: listingRegionBySlug,
    formatListingLocation: formatListingLocation,
    parseStoredListingLocation: parseStoredListingLocation,
    extraHighlightFromMeta: extraHighlightFromMeta,
    cookieWindowFromMeta: cookieWindowFromMeta,
    formatAffiliateCookieDisplay: formatAffiliateCookieDisplay,
    affiliateCookieShortLabel: affiliateCookieShortLabel,
  };
})(typeof window !== 'undefined' ? window : globalThis);
