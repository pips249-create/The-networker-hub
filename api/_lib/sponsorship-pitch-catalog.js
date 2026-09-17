/**
 * Sponsorship / advertising placements for tailored sales pitch decks.
 * Labels align with /advertising packages.
 */
const SPONSORSHIP_PLACEMENT_CATALOG = {
  headline_events: {
    group: 'Events',
    nav: 'Events Headline',
    kicker: 'Events directory',
    title: 'Headline Sponsor — UK Events Directory',
    price: '£2,000 / month + VAT',
    bullets: [
      'Exclusive “Powered by” hero at the top of /events/ — one partner at a time',
      'Logo and link in the header of attendee booking emails we send',
      'Best for B2B brands reaching people actively booking networking events',
      'Monthly or prepaid 1 / 3 / 6 / 12 months (5–15% off longer terms)',
    ],
  },
  event_page_partner: {
    group: 'Events',
    nav: 'Event pages',
    kicker: 'At checkout',
    title: 'Event Page Partner — sidebar on event listings',
    price: '£600 / slot / month + VAT',
    bullets: [
      'Mini Sponsor rotation on individual event detail pages at the booking moment',
      'Shared inventory with selected attendee emails — up to three logos per carousel',
      'Targets motivated attendees reviewing venue, time, and ticket options',
      'Monthly or prepaid terms with volume discounts on longer commits',
    ],
  },
  featured_event_boost: {
    group: 'Events',
    nav: 'Event boost',
    kicker: 'Organiser self-serve',
    title: 'Featured Event Boost — Premium Spotlight',
    price: '£55 one-time',
    bullets: [
      'Pins an event to the top of /events/ search and browse (max 12 live slots)',
      'Premium card with Featured badge — runs until the event starts (up to 30 days)',
      'One-time checkout from the organiser dashboard — not a subscription',
      'Ideal when pitching event organisers who need ticket velocity',
    ],
  },
  city_sponsor: {
    group: 'Regional',
    nav: 'City Sponsor',
    kicker: 'Hyperlocal',
    title: 'City Sponsor — exclusive city pages',
    price: 'From £29 / city / month + VAT',
    bullets: [
      'One partner per city on /networking/{city} beside local intro copy',
      'Multi-city bundles (e.g. three cities) with packaged pricing',
      'Website placement — professionals browsing events in that city',
      'Monthly, 6-month, or yearly prepaid (10–15% savings)',
    ],
  },
  county_sponsor_events: {
    group: 'Regional',
    nav: 'Events county',
    kicker: 'County page',
    title: 'County Sponsor — Events county networking pages',
    price: 'From £49 / county / month + VAT (launch pricing)',
    bullets: [
      'Exclusive logo + link on /networking/{county} for Events',
      'Built for franchise and county-wide meeting programmes',
      'Separate inventory from Opportunities county sponsorship',
      'Checkout online with monthly or prepaid terms',
    ],
  },
  headline_organisers: {
    group: 'Organisers',
    nav: 'Organisers Headline',
    kicker: 'Organiser directory',
    title: 'Headline Sponsor — UK Organisers Directory',
    price: '£2,000 / month + VAT',
    bullets: [
      'Powered-by hero when visitors browse networking groups on /events/?mode=organisers',
      'Logo in selected organiser-facing emails',
      'Reach group owners and chapter leaders comparing platforms',
      'Same monthly / prepaid structure as Events Headline Sponsor',
    ],
  },
  organiser_page_partner: {
    group: 'Organisers',
    nav: 'Organiser pages',
    kicker: 'Profile sidebar',
    title: 'Organiser Page Partner — Mini Sponsors on group profiles',
    price: '£600 / slot / month + VAT',
    bullets: [
      'Rotating sidebar on public organiser profile pages',
      'Shared email inventory for organiser communications — separate from Event Page Partner',
      'Up to three concurrent Mini Sponsor logos',
      'Monthly or prepaid 1–12 month terms',
    ],
  },
  featured_organiser_boost: {
    group: 'Organisers',
    nav: 'Organiser boost',
    kicker: 'Premium Spotlight',
    title: 'Featured Organiser Boost',
    price: '£55 one-time',
    bullets: [
      'Premium Spotlight placement for an organiser profile in directory browse',
      'Featured badge and top-row priority on organiser discovery',
      'One-time boost — useful upsell when they already list events',
    ],
  },
  headline_opportunities: {
    group: 'Opportunities',
    nav: 'Opps Headline',
    kicker: 'Opportunities directory',
    title: 'Headline Sponsor — Business Opportunities Directory',
    price: '£2,000 / month + VAT',
    bullets: [
      'Powered-by hero on /opportunities/ browse',
      'Logo in business opportunity emails to members and enquirers',
      'Audience actively researching franchises, partnerships, and investments',
      'One Headline partner at a time — no competing sponsors in-slot',
    ],
  },
  opportunity_county_sponsor: {
    group: 'Regional',
    nav: 'Opps county',
    kicker: 'County page',
    title: 'County Sponsor — Opportunities county pages',
    price: 'From £49 / county / month + VAT',
    bullets: [
      'Exclusive partner on /opportunities/networking/{county}',
      'Separate from Events county inventory',
      'Year-round visibility where county opportunity browsers land',
    ],
  },
  industry_sponsor: {
    group: 'Opportunities',
    nav: 'Industry',
    kicker: 'Category page',
    title: 'Industry Sponsor — opportunity categories',
    price: 'Enquiry-led · bespoke',
    bullets: [
      'Logo placement on /opportunities/?category={industry} style landing',
      'Manual setup after partnerships review — ideal for sector specialists',
      'Pairs with enquiry workflow in Command Centre → Sponsorship',
    ],
  },
  opportunity_page_partner: {
    group: 'Opportunities',
    nav: 'Opportunity pages',
    kicker: 'Detail sidebar',
    title: 'Opportunity Page Partner — Mini Sponsors on listings',
    price: '£600 / slot / month + VAT',
    bullets: [
      'Sidebar carousel on individual opportunity detail pages',
      'Selected opportunity emails share the same three-logo inventory',
      'Reaches buyers reading investment levels and sending enquiries',
    ],
  },
  opportunity_directory_listing: {
    group: 'Opportunities',
    nav: 'Directory listing',
    kicker: 'List your opportunity',
    title: 'Business opportunity directory listing',
    price: '£25 / month + VAT',
    bullets: [
      'Public detail page plus inclusion in /opportunities/ search while subscribed',
      'For businesses listing their own franchise, acquisition, or partnership offer',
      'Member enquiries routed to the listing owner — no per-lead fee',
      'Does not include Headline Sponsor, email blasts, or Featured Boost (available separately)',
    ],
  },
  featured_opportunity_boost: {
    group: 'Opportunities',
    nav: 'Opportunity boost',
    kicker: 'Premium Spotlight',
    title: 'Featured Opportunity Boost',
    price: '£55 one-time',
    bullets: [
      'Pins a listing to the top row of opportunities browse (max 12 featured slots)',
      'Featured badge and highlighted card for higher click-through',
      'One-time payment for up to 30 days — stacks with monthly directory listing',
    ],
  },
};

const SPONSORSHIP_PLACEMENT_ORDER = [
  'headline_events',
  'event_page_partner',
  'featured_event_boost',
  'city_sponsor',
  'county_sponsor_events',
  'headline_organisers',
  'organiser_page_partner',
  'featured_organiser_boost',
  'headline_opportunities',
  'opportunity_directory_listing',
  'opportunity_page_partner',
  'featured_opportunity_boost',
  'opportunity_county_sponsor',
  'industry_sponsor',
];

const DECK_TYPES = new Set(['organiser', 'sponsorship', 'combined']);

function normalizeDeckType(raw) {
  const t = String(raw || 'organiser')
    .trim()
    .toLowerCase();
  return DECK_TYPES.has(t) ? t : 'organiser';
}

function normalizeSponsorshipPlacements(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const out = [];
  list.forEach(function (key) {
    const k = String(key || '').trim();
    if (SPONSORSHIP_PLACEMENT_CATALOG[k] && out.indexOf(k) === -1) out.push(k);
  });
  return out;
}

function hasOpportunityListingLaunchOffer(placements) {
  return (placements || []).indexOf('opportunity_directory_listing') !== -1;
}

function hasOpportunitySpotlightLaunchOffer(placements) {
  return (placements || []).indexOf('featured_opportunity_boost') !== -1;
}

function applyOpportunityLaunchOfferToSection(key, section, companyName) {
  const co = companyName || 'your brand';
  if (key === 'opportunity_directory_listing') {
    section.price = 'Included — 12 months at no charge';
    section.intro =
      'Launch partnership offer for ' +
      co +
      ': a full business opportunity directory listing on /opportunities/ with member enquiries routed to you — subscription fees waived for the first year.' +
      (section.intro ? ' ' + section.intro : '');
    section.bullets = [
      '12 months of the standard directory listing at no subscription charge (normally £25/month + VAT)',
      'Public detail page plus inclusion in /opportunities/ search and browse while the offer is active',
      'Member enquiries routed to your listing owner — no per-lead fee during the included year',
      'After month 12, continue at the published listing rate or pause — Headline Sponsor and email inventory remain separate packages',
    ];
  }
  if (key === 'featured_opportunity_boost') {
    section.price = 'Included — 3 months Premium Spotlight';
    section.intro =
      'Launch partnership offer for ' +
      co +
      ': stay in the Premium Spotlight carousel on /opportunities/ for three months at no charge.' +
      (section.intro ? ' ' + section.intro : '');
    section.bullets = [
      '3 months of Premium Spotlight on the opportunities browse carousel at no charge (normally £55 per ~30-day boost)',
      'Featured badge and highlighted card for higher click-through while each spotlight month is live',
      'We schedule the three spotlight windows in Command Centre — no Stripe checkout required for this launch offer',
      'Stacks with the directory listing — ideal for franchise and partnership offers that need visibility fast',
    ];
  }
  return section;
}

function buildSponsorshipSections(placements, companyName, brief, options) {
  const co = companyName || 'your brand';
  const briefBit = brief ? String(brief).trim() : '';
  const applyLaunch =
    !options || options.applyOpportunityLaunchOffer !== false;
  return placements.map(function (key) {
    const p = SPONSORSHIP_PLACEMENT_CATALOG[key];
    let intro = 'Why this fits ' + co + '.';
    if (briefBit) intro += ' ' + briefBit;
    const section = {
      id: 'sponsor_' + key,
      navLabel: p.nav,
      kicker: p.kicker,
      title: p.title,
      intro: intro,
      bullets: (p.bullets || []).slice(),
      price: p.price || '',
      tiles: [],
      quote: '',
    };
    if (applyLaunch) {
      applyOpportunityLaunchOfferToSection(key, section, co);
    }
    return section;
  });
}

function launchOfferHeroChips(placements) {
  const chips = [];
  if (hasOpportunityListingLaunchOffer(placements)) {
    chips.push('12 months listing included');
  }
  if (hasOpportunitySpotlightLaunchOffer(placements)) {
    chips.push('3 months Premium Spotlight included');
  }
  if (chips.length) chips.push('Launch partnership offer');
  return chips;
}

module.exports = {
  SPONSORSHIP_PLACEMENT_CATALOG,
  SPONSORSHIP_PLACEMENT_ORDER,
  DECK_TYPES,
  normalizeDeckType,
  normalizeSponsorshipPlacements,
  buildSponsorshipSections,
  hasOpportunityListingLaunchOffer,
  hasOpportunitySpotlightLaunchOffer,
  launchOfferHeroChips,
};
