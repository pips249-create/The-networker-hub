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

  var SEED_LISTINGS = [
    {
      type: 'franchise',
      tags: ['franchise'],
      featured: true,
      host: 'Sparkle & Shine Ltd',
      hostInitials: 'SS',
      hostColor: '#7a5c0a',
      title: 'Domestic Cleaning Franchise — Full Territory',
      desc: 'Proven 12-year model. Full training, CRM, and branded materials. Territories across Yorkshire and the Midlands.',
      about: [
        'Join a proven domestic cleaning franchise with over 12 years of UK trading history. This territory package includes full induction training, CRM access, branded uniforms and marketing templates, plus ongoing operational support.',
        'Ideal for someone ready to build a team-led business with recurring client contracts across Yorkshire and the Midlands.',
      ],
      meta: [
        { key: 'Investment', val: '£9,500' },
        { key: 'Return est.', val: '18–24 months' },
        { key: 'Location', val: 'Yorkshire' },
        { key: 'Commitment', val: 'Full-time' },
      ],
    },
    {
      type: 'side-hustle',
      tags: ['side-hustle', 'remote', 'low-invest'],
      featured: false,
      host: 'Flat Lay Studio',
      hostInitials: 'FL',
      hostColor: '#0d5a52',
      title: 'Branded Product Photography — Reseller Model',
      desc: 'Edit product photos for e-commerce brands from home. Flexible hours; paid per project.',
      about: [
        'Work with e-commerce brands on product photography edits from home. We provide the clients, briefs and QC — you deliver polished images on a per-project basis.',
        'Flexible hours make this ideal as a side hustle alongside another business or employed role.',
      ],
      meta: [
        { key: 'Investment', val: '£0' },
        { key: 'Earnings', val: '£400–£900/mo' },
        { key: 'Location', val: 'Remote' },
        { key: 'Commitment', val: 'Flexible' },
      ],
    },
    {
      type: 'franchise',
      tags: ['franchise'],
      featured: false,
      host: 'GreenBox Foods',
      hostInitials: 'GB',
      hostColor: '#166534',
      title: 'Health Food Kiosk — Shopping Centres',
      desc: 'Compact kiosk format for high-footfall retail. Full supply chain, POS, and branded packaging.',
      about: [
        'Compact health-food kiosk format designed for shopping centres and retail parks. Includes supply chain setup, POS, branded packaging and launch marketing support.',
        'Average operators reach profitability within six months based on current network performance.',
      ],
      meta: [
        { key: 'Investment', val: '£22,000' },
        { key: 'Return est.', val: '6–12 months' },
        { key: 'Spaces left', val: '4' },
        { key: 'Support', val: 'Full onboarding' },
      ],
    },
    {
      type: 'partnership',
      tags: ['partnership', 'remote', 'low-invest'],
      featured: false,
      host: 'Bolt Digital Agency',
      hostInitials: 'BD',
      hostColor: '#1d4ed8',
      title: 'White-Label Web Design — Agency Reseller',
      desc: 'Sell websites under your own brand. We build, you bill. Ideal for consultants and coaches.',
      about: [
        'Resell professional websites under your own brand while our team handles design, development and delivery. You own the client relationship and invoice directly.',
        'Popular with VAs, consultants and coaches who want to add digital services without hiring in-house.',
      ],
      meta: [
        { key: 'Investment', val: '£0' },
        { key: 'Commission', val: '25–40%' },
        { key: 'Location', val: 'Remote' },
        { key: 'Commitment', val: 'Flexible' },
      ],
    },
    {
      type: 'franchise',
      tags: ['franchise'],
      featured: false,
      host: 'Pawfect Groom',
      hostInitials: 'PG',
      hostColor: '#6b21a8',
      title: 'Dog Grooming Franchise — Mobile Van',
      desc: 'Fully kitted mobile grooming van in your postcode. Training, booking software, and branding included.',
      about: [
        'Operate a fully kitted mobile dog grooming van in your exclusive postcode territory. Package includes vehicle branding, booking software, equipment and certified training.',
        'Strong demand from pet owners seeking convenient at-home grooming across the UK.',
      ],
      meta: [
        { key: 'Investment', val: '£14,500' },
        { key: 'Return est.', val: '12 months' },
        { key: 'Vans left', val: '6' },
        { key: 'Commitment', val: 'Full-time' },
      ],
    },
    {
      type: 'side-hustle',
      tags: ['side-hustle', 'low-invest'],
      featured: false,
      host: 'ClearLedger UK',
      hostInitials: 'CL',
      hostColor: '#374151',
      title: 'Bookkeeping Partner — Sole Traders & SMEs',
      desc: 'Licensed partner model for local small businesses. Ideal for those with admin or accounting experience.',
      about: [
        'Service local sole traders and SMEs using our licensed bookkeeping platform. Training and compliance support included.',
        'Part-time friendly — many partners start evenings and weekends before going full-time.',
      ],
      meta: [
        { key: 'Investment', val: '£1,800' },
        { key: 'Earnings', val: '£1.2–3k/mo' },
        { key: 'Location', val: 'Your area' },
        { key: 'Commitment', val: 'Part-time OK' },
      ],
    },
    {
      type: 'networking',
      tags: ['networking', 'low-invest'],
      featured: false,
      host: 'Connect Midlands',
      hostInitials: 'CM',
      hostColor: '#9d174d',
      title: 'Regional Ambassador — Business Networking Groups',
      desc: 'Launch and grow paid networking meetings in your area. Playbook, branding and member recruitment support included.',
      about: [
        'Launch and grow paid business networking groups in your region with our ambassador playbook, branded materials and recruitment templates.',
        'Built for confident communicators who enjoy bringing local business communities together.',
      ],
      meta: [
        { key: 'Investment', val: '£2,500' },
        { key: 'Earnings', val: '£2–5k/mo' },
        { key: 'Location', val: 'West Midlands' },
        { key: 'Commitment', val: 'Flexible' },
      ],
    },
    {
      type: 'distributorship',
      tags: ['distributorship', 'remote'],
      featured: false,
      host: 'BrewCraft Supplies',
      hostInitials: 'BC',
      hostColor: '#92400e',
      title: 'Speciality Coffee Distributorship — Cafés & Offices',
      desc: 'Exclusive territory for wholesale coffee and equipment. Training, samples and marketing materials provided.',
      about: [
        'Exclusive wholesale territory supplying speciality coffee and equipment to cafés, offices and hospitality venues.',
        'Includes product training, sample kits and co-branded marketing materials to help you win local accounts.',
      ],
      meta: [
        { key: 'Investment', val: '£8,000' },
        { key: 'Commission', val: '18–28%' },
        { key: 'Location', val: 'South West' },
        { key: 'Commitment', val: 'Flexible' },
      ],
    },
    {
      type: 'business-opportunity',
      tags: ['business-opportunity', 'franchise'],
      featured: false,
      host: 'FitSpace UK',
      hostInitials: 'FS',
      hostColor: '#0f766e',
      title: 'Micro-Gym License — High Street Units',
      desc: 'Turnkey small-format fitness studio model for town centres. Equipment lease, ops manual and launch marketing.',
      about: [
        'Turnkey micro-gym licence for compact high-street units. Includes equipment lease options, operations manual, class programming and local launch marketing.',
        'Designed for operators who want a fitness brand without building everything from scratch.',
      ],
      meta: [
        { key: 'Investment', val: '£35,000' },
        { key: 'Return est.', val: '18 mo' },
        { key: 'Territories', val: '3 left' },
        { key: 'Commitment', val: 'Full-time' },
      ],
    },
  ];

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

  function buildSearchText(item) {
    return [item.title, item.host, item.desc, item.type]
      .concat(item.tags || [])
      .concat((item.meta || []).map(function (m) {
        return m.key + ' ' + m.val;
      }))
      .join(' ')
      .toLowerCase();
  }

  function normalizeListing(seed, index) {
    var item = Object.assign({}, seed);
    item.id = 'opp-' + (index + 1);
    item.tags = (seed.tags || []).slice();
    item.meta = (seed.meta || []).map(function (m) {
      return { key: m.key, val: m.val };
    });
    item.about = (seed.about || []).slice();
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
        item.searchText = buildSearchText(item);
      }
      out.push(item);
    }
    return out;
  }

  function resolveCatalogSize() {
    var param = new URLSearchParams(window.location.search).get('listings');
    var n = parseInt(param, 10);
    if (n > 0) return Math.min(n, 5000);
    return SEED_LISTINGS.length;
  }

  function loadCatalog() {
    return expandCatalog(SEED_LISTINGS, resolveCatalogSize());
  }

  function getById(id) {
    var key = String(id || '');
    if (!key) return null;
    var catalog = loadCatalog();
    for (var i = 0; i < catalog.length; i++) {
      if (catalog[i].id === key) return catalog[i];
    }
    return null;
  }

  function detailHref(item) {
    var id = typeof item === 'string' ? item : item && item.id;
    if (!id) return 'browse.html';
    return 'opportunity.html?id=' + encodeURIComponent(id);
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
    resolveCatalogSize: resolveCatalogSize,
    loadCatalog: loadCatalog,
    getById: getById,
    detailHref: detailHref,
    typeClass: typeClass,
  };

  window.hubOpportunityDetailHref = detailHref;
})();
