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
    {
      type: 'partnership',
      tags: ['partnership', 'low-invest', 'event-based'],
      featured: true,
      host: 'Roast & Rally',
      hostInitials: 'RR',
      hostColor: '#7a5c0a',
      title: 'Coffee Cart Concession — Events & Markets',
      desc: 'Operate a branded cart at festivals, markets and corporate events. Equipment loan, training and brand included.',
      about: [
        'Run a branded coffee cart at festivals, farmers markets and corporate hospitality events across the UK.',
        'We provide the equipment loan, barista training and brand assets — you cover pitch fees and keep the margin.',
      ],
      meta: [
        { key: 'Investment', val: '£2,200' },
        { key: 'Earnings', val: '£200–£600/day' },
        { key: 'Slots left', val: '3' },
        { key: 'Commitment', val: 'Event-based' },
      ],
    },
    {
      type: 'side-hustle',
      tags: ['side-hustle', 'remote', 'low-invest'],
      featured: false,
      host: 'SkillBridge Platform',
      hostInitials: 'SB',
      hostColor: '#854d0e',
      title: 'Online Course Creator — 70% Revenue Share',
      desc: 'Package your expertise into a course on our marketplace. We handle payments, marketing and hosting.',
      about: [
        'Turn your professional expertise into a sellable online course on The Networker Academy marketplace.',
        'We handle hosting, checkout and promotion — you keep 70% of every sale with no upfront listing fee.',
      ],
      meta: [
        { key: 'Investment', val: '£0' },
        { key: 'Revenue share', val: '70%' },
        { key: 'Location', val: 'Remote' },
        { key: 'Commitment', val: 'Flexible' },
      ],
    },
    {
      type: 'franchise',
      tags: ['franchise'],
      featured: false,
      host: 'FixRight Services',
      hostInitials: 'FR',
      hostColor: '#0c4a6e',
      title: 'Property Maintenance — Handyman Franchise',
      desc: 'Join a national network of trusted tradespeople. CRM, job allocation, uniform and insurance all provided.',
      about: [
        'Operate under a trusted national property maintenance brand with vetted leads from day one.',
        'Includes CRM, job allocation, branded uniform, insurance setup and ongoing marketing support.',
      ],
      meta: [
        { key: 'Investment', val: '£3,500' },
        { key: 'Return est.', val: '3–6 months' },
        { key: 'Territories', val: '12 left' },
        { key: 'Commitment', val: 'Full or part' },
      ],
    },
    {
      type: 'franchise',
      tags: ['franchise'],
      featured: false,
      host: 'FitSpace Studios',
      hostInitials: 'FS',
      hostColor: '#065f46',
      title: 'Personal Training Studio — Compact Franchise',
      desc: 'Open a compact PT studio using our proven layout, software and booking system. Equipment package included.',
      about: [
        'Launch a compact personal training studio with our proven room layout, booking software and class programming.',
        'Equipment package, branding and local launch marketing included — ideal for qualified PTs ready to go solo.',
      ],
      meta: [
        { key: 'Investment', val: '£34,000' },
        { key: 'Return est.', val: '18 months' },
        { key: 'Spaces left', val: '2' },
        { key: 'Location', val: 'South England' },
      ],
    },
    {
      type: 'networking',
      tags: ['networking', 'low-invest'],
      featured: false,
      host: 'NorthEast BizConnect',
      hostInitials: 'NE',
      hostColor: '#9a3412',
      title: 'Breakfast Networking Host — Monthly Meetings',
      desc: 'License our breakfast networking format for your city. Playbook, branding and member CRM included.',
      about: [
        'Host a monthly breakfast networking meeting for local business owners using our proven format and brand.',
        'Includes facilitator playbook, branded materials, member CRM and promotion across The Networker channels.',
      ],
      meta: [
        { key: 'Investment', val: '£1,200' },
        { key: 'Earnings', val: '£800–£2k/mo' },
        { key: 'Location', val: 'Newcastle' },
        { key: 'Commitment', val: 'Part-time OK' },
      ],
    },
    {
      type: 'distributorship',
      tags: ['distributorship'],
      featured: false,
      host: 'PureGlow Skincare',
      hostInitials: 'PG',
      hostColor: '#be185d',
      title: 'Beauty & Wellness Distributorship — Salons & Spas',
      desc: 'Exclusive wholesale territory for professional skincare lines. Training days and sample kits provided.',
      about: [
        'Build a wholesale book supplying professional skincare to salons, spas and aesthetic clinics in your territory.',
        'Includes product training, sample kits and co-branded collateral to support account wins.',
      ],
      meta: [
        { key: 'Investment', val: '£5,500' },
        { key: 'Commission', val: '22–32%' },
        { key: 'Location', val: 'Manchester' },
        { key: 'Commitment', val: 'Flexible' },
      ],
    },
    {
      type: 'side-hustle',
      tags: ['side-hustle', 'remote', 'low-invest'],
      featured: false,
      host: 'VoiceBox Media',
      hostInitials: 'VM',
      hostColor: '#4c1d95',
      title: 'Podcast Editing Partner — B2B Shows',
      desc: 'Edit and produce podcasts for business clients from home. Steady pipeline of shows; paid per episode.',
      about: [
        'Edit and master B2B podcast episodes for our roster of business clients from your home studio.',
        'Steady episode pipeline, clear briefs and QC checklist — ideal for audio editors seeking flexible income.',
      ],
      meta: [
        { key: 'Investment', val: '£0' },
        { key: 'Earnings', val: '£500–£1.2k/mo' },
        { key: 'Location', val: 'Remote' },
        { key: 'Commitment', val: 'Part-time OK' },
      ],
    },
    {
      type: 'business-opportunity',
      tags: ['business-opportunity'],
      featured: true,
      host: 'EV Charge UK',
      hostInitials: 'EV',
      hostColor: '#0369a1',
      title: 'EV Charger Installation Partner — Commercial Sites',
      desc: 'Refer commercial sites for EV charger installs. High-ticket commissions on qualified leads you source.',
      about: [
        'Source commercial landlords, retail parks and fleet operators for EV charger installation projects.',
        'High-ticket commission on qualified leads that convert — training and sales collateral provided.',
      ],
      meta: [
        { key: 'Investment', val: '£0' },
        { key: 'Commission', val: '£800–£3k/lead' },
        { key: 'Location', val: 'UK-wide' },
        { key: 'Commitment', val: 'Flexible' },
      ],
    },
    {
      type: 'franchise',
      tags: ['franchise'],
      featured: false,
      host: 'TyrePro Mobile',
      hostInitials: 'TP',
      hostColor: '#1e3a5f',
      title: 'Mobile Tyre Fitting Franchise — Fleet & Retail',
      desc: 'Fully equipped van franchise serving fleets and consumers at home or workplace. Strong repeat demand.',
      about: [
        'Operate a mobile tyre fitting van serving fleet contracts and retail customers at home or workplace.',
        'Fully equipped vehicle, booking system, supplier terms and launch marketing included in the package.',
      ],
      meta: [
        { key: 'Investment', val: '£28,000' },
        { key: 'Return est.', val: '14–20 months' },
        { key: 'Vans left', val: '4' },
        { key: 'Location', val: 'London' },
      ],
    },
    {
      type: 'partnership',
      tags: ['partnership', 'remote', 'low-invest'],
      featured: false,
      host: 'CloudSecure IT',
      hostInitials: 'CS',
      hostColor: '#0f766e',
      title: 'Managed IT Reseller — SME Accounts',
      desc: 'Sell managed IT support under your brand. We monitor, patch and helpdesk — you own the relationship.',
      about: [
        'Resell managed IT support to SMEs under your own brand while our NOC handles monitoring and helpdesk.',
        'Popular with consultants and accountants who want recurring IT revenue without hiring engineers.',
      ],
      meta: [
        { key: 'Investment', val: '£500' },
        { key: 'Commission', val: '20–35% MRR' },
        { key: 'Location', val: 'Remote' },
        { key: 'Commitment', val: 'Flexible' },
      ],
    },
    {
      type: 'networking',
      tags: ['networking', 'low-invest'],
      featured: false,
      host: 'Women in Business Leeds',
      hostInitials: 'WB',
      hostColor: '#9d174d',
      title: 'Women\'s Networking Circle — City License',
      desc: 'Launch a paid women\'s business networking circle in your city. Curriculum, branding and launch kit included.',
      about: [
        'Launch a paid women\'s business networking circle with our session curriculum, branding and facilitator guide.',
        'Built for organisers who want a structured community model with recurring membership revenue.',
      ],
      meta: [
        { key: 'Investment', val: '£950' },
        { key: 'Earnings', val: '£1.5–4k/mo' },
        { key: 'Location', val: 'Leeds' },
        { key: 'Commitment', val: 'Part-time OK' },
      ],
    },
    {
      type: 'side-hustle',
      tags: ['side-hustle', 'low-invest'],
      featured: false,
      host: 'Holiday Let Co',
      hostInitials: 'HL',
      hostColor: '#b45309',
      title: 'Airbnb Co-Host Partner — Local Properties',
      desc: 'Manage guest comms, turnovers and reviews for local holiday lets. Share of booking revenue, no property needed.',
      about: [
        'Co-host local holiday lets by handling guest messaging, cleaner coordination and review management.',
        'Earn a share of booking revenue without owning property — ideal for organised locals with hospitality flair.',
      ],
      meta: [
        { key: 'Investment', val: '£0' },
        { key: 'Earnings', val: '£300–£800/mo' },
        { key: 'Location', val: 'Bristol' },
        { key: 'Commitment', val: 'Flexible' },
      ],
    },
    {
      type: 'distributorship',
      tags: ['distributorship'],
      featured: false,
      host: 'Artisan Bake Supply',
      hostInitials: 'AB',
      hostColor: '#a16207',
      title: 'Artisan Bakery Supply — Wholesale Territory',
      desc: 'Supply independent bakeries and cafés with flour, mixes and packaging. Exclusive patch, repeat orders.',
      about: [
        'Exclusive wholesale territory supplying artisan bakeries and cafés with flour, mixes and packaging.',
        'Repeat-order model with sample days, product training and route-planning support for new distributors.',
      ],
      meta: [
        { key: 'Investment', val: '£6,500' },
        { key: 'Commission', val: '15–25%' },
        { key: 'Location', val: 'Scotland' },
        { key: 'Commitment', val: 'Full-time' },
      ],
    },
    {
      type: 'business-opportunity',
      tags: ['business-opportunity', 'franchise'],
      featured: false,
      host: 'Little Linguists',
      hostInitials: 'LL',
      hostColor: '#7c3aed',
      title: 'Children\'s Language School License — After-School Clubs',
      desc: 'Run after-school language clubs in primary schools. Curriculum, DBS guidance and parent marketing included.',
      about: [
        'License our after-school language club model for primary schools in your area.',
        'Includes full curriculum, DBS guidance, parent marketing templates and termly lesson plans.',
      ],
      meta: [
        { key: 'Investment', val: '£4,200' },
        { key: 'Earnings', val: '£2–4k/term' },
        { key: 'Territories', val: '5 left' },
        { key: 'Location', val: 'Wales' },
      ],
    },
    {
      type: 'franchise',
      tags: ['franchise'],
      featured: false,
      host: 'BrightWindows Co',
      hostInitials: 'BW',
      hostColor: '#0284c7',
      title: 'Window Cleaning Round — Residential Franchise',
      desc: 'Build a recurring residential round with branded van, water-fed pole kit and route software.',
      about: [
        'Build a recurring residential and commercial window cleaning round with branded van and equipment package.',
        'Includes water-fed pole kit, route software, uniform and local launch marketing to fill your diary fast.',
      ],
      meta: [
        { key: 'Investment', val: '£7,800' },
        { key: 'Return est.', val: '8–12 months' },
        { key: 'Location', val: 'Liverpool' },
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
    if (/south|london|bristol/.test(searchBlob)) tags.push('south');
    if (/uk-wide|uk wide|your area|various/.test(searchBlob)) tags.push('uk-wide');
    var comm = metaVal(item.meta, /^commitment$/i).toLowerCase();
    if (/full/.test(comm)) tags.push('full-time');
    if (/part|flex/.test(comm)) tags.push('part-time');
    if (/event/.test(comm)) tags.push('event-based');
    if (item.category && item.category !== 'general') tags.push('cat-' + item.category);
    item.filterTags = tags;
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
    if (/^investment|earnings|commission|revenue|income|profit|return/.test(k)) {
      if (/%/.test(v)) return v;
      if (/\d/.test(v)) return '£' + v;
    }
    return v;
  }

  function cardDisplayMeta(item) {
    var meta = item.meta || [];
    var investment = null;
    var financial = null;
    var scarcity = null;
    var location = null;
    var extra = [];

    meta.forEach(function (m) {
      if (/^investment$/i.test(m.key)) investment = m;
      else if (/^(return(\s+est\.?)?|earnings|commission|revenue|income|profit)$/i.test(m.key)) financial = financial || m;
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

    return [investment, financial, row3, row4].filter(Boolean).slice(0, 4);
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
    return {
      id: row.id,
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
    item.imageUrl = String(seed.imageUrl || '').trim();
    item.logoUrl = String(seed.logoUrl || '').trim();
    item.investAmount = parseInvestmentAmount(item.meta);
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

  function resolveCatalogSize() {
    var param = new URLSearchParams(window.location.search).get('listings');
    var n = parseInt(param, 10);
    if (n > 0) return Math.min(n, 5000);
    return SEED_LISTINGS.length;
  }

  function loadCatalog() {
    return expandCatalog(SEED_LISTINGS, resolveCatalogSize());
  }

  function loadCatalogAsync() {
    var seeds = loadCatalog();
    return fetch('/api/opportunities', { credentials: 'omit', cache: 'no-store' })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.ok || !Array.isArray(data.opportunities) || !data.opportunities.length) {
          return seeds;
        }
        var live = data.opportunities.map(function (row, i) {
          return normalizeListing(apiRowToSeed(row), i);
        });
        return live.concat(seeds);
      })
      .catch(function () {
        return seeds;
      });
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

  function fetchById(id) {
    var key = String(id || '');
    if (!key) return Promise.resolve(null);
    var cached = getById(key);
    if (cached) return Promise.resolve(cached);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
      return Promise.resolve(null);
    }
    return fetch('/api/opportunities?id=' + encodeURIComponent(key), { credentials: 'omit', cache: 'no-store' })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.ok || !data.opportunity) return null;
        return normalizeListing(apiRowToSeed(data.opportunity), 0);
      })
      .catch(function () {
        return null;
      });
  }

  function detailHref(item) {
    var id = typeof item === 'string' ? item : item && item.id;
    if (!id) return 'index.html';
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
    loadCatalogAsync: loadCatalogAsync,
    getById: getById,
    fetchById: fetchById,
    apiRowToSeed: apiRowToSeed,
    detailHref: detailHref,
    typeClass: typeClass,
    cardDisplayMeta: cardDisplayMeta,
    formatMetaDisplayValue: formatMetaDisplayValue,
    isScarcityMeta: isScarcityMeta,
    parseInvestmentAmount: parseInvestmentAmount,
    CATEGORY_KEYWORDS: CATEGORY_KEYWORDS,
  };

  window.hubOpportunityDetailHref = detailHref;
})();
