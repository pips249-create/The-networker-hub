/**
 * Sponsorship / advertising placements for tailored sales pitch decks.
 * Labels align with /advertising packages.
 */

/** Headline email inventories — counts/lists match /advertising rate card. */
const HEADLINE_EMAIL_INVENTORIES = {
  headline_events: {
    audience: 'attendee',
    label: 'Attendee emails with Headline Sponsor placement',
    shortLabel: 'Attendee emails',
    templates: [
      'Booking confirmation',
      'Event reminder',
      'Online join reminder',
      'Saved event — tickets open',
      'Saved organiser — new listing',
      'Application received',
      'Application approved',
      'Application denied',
      'Meeting link added',
      'Event details updated',
      'Post-event review request',
      'Guest visit follow-up',
      'Category exclusivity payment reminder',
      'Alumni fast pass invite',
      'Attendee re-engagement',
      'Sign-up events nudge',
      'Sign-up events nudge (follow-up)',
      'Hubert event concierge',
      'Booking cancelled',
      'Event cancelled',
      'Refund processed',
    ],
    reach: {
      emailLabel: 'Attendee email reach',
      emailRange: '4,000 – 12,000 / mo',
      directoryRange: '8,000 – 18,000 / mo',
      combinedRange: '12,000 – 30,000 / mo',
    },
  },
  headline_organisers: {
    audience: 'organiser',
    label: 'Organiser emails with Headline Sponsor placement',
    shortLabel: 'Organiser emails',
    templates: [
      'New registration',
      'New application',
      'Booking cancelled',
      'Event removed by platform',
      'Event unpublished by platform',
      'Listing unpublished by platform',
      'Platform warning',
      'Platform suspended',
      'Ranking badge',
      'Low upcoming events',
      'Ticket sales nudge',
      'Featured expiry reminder',
      'Claim invite',
      'Launch invite',
      'Team invite',
      'Email verify',
      'Stripe Connect nudge',
      'Payout requested',
      'Payout approved',
      'Payout paid',
      'Event almost full',
    ],
    reach: {
      emailLabel: 'Organiser email reach',
      emailRange: '2,000 – 6,000 / mo',
      directoryRange: '3,000 – 8,000 / mo',
      combinedRange: '5,000 – 14,000 / mo',
    },
  },
  headline_opportunities: {
    audience: 'opportunity',
    label: 'Opportunity emails with Headline Sponsor placement',
    shortLabel: 'Opportunity emails',
    templates: [
      'Listing live',
      'Listing expiry reminder',
      'Premium expiry reminder',
      'Premium live',
      'Enquiry received',
      'Enquiry sent',
      'Listing expired',
      'Premium expired',
      'Listing rejected',
      'Saved opportunity closing soon',
      'Saved search match',
    ],
    reach: {
      emailLabel: 'Opportunity email reach',
      emailRange: '1,200 – 3,500 / mo',
      directoryRange: '2,000 – 5,000 / mo',
      combinedRange: '3,000 – 8,500 / mo',
    },
  },
};

function emailInventoryForPlacement(key) {
  const inv = HEADLINE_EMAIL_INVENTORIES[key];
  if (!inv) return null;
  const templates = (inv.templates || []).slice();
  return {
    placementKey: key,
    audience: inv.audience,
    label: inv.label,
    shortLabel: inv.shortLabel,
    templates: templates,
    count: templates.length,
    reach: inv.reach ? Object.assign({}, inv.reach) : null,
  };
}

function tallyEmailInventories(placements) {
  const list = Array.isArray(placements) ? placements : [];
  const parts = [];
  let total = 0;
  list.forEach(function (key) {
    const inv = emailInventoryForPlacement(key);
    if (!inv) return;
    total += inv.count;
    parts.push(inv);
  });
  return { total: total, parts: parts };
}

const SPONSORSHIP_PLACEMENT_CATALOG = {
  headline_events: {
    group: 'Events',
    nav: 'Events Headline',
    kicker: 'Events directory',
    title: 'Headline Sponsor — UK Events Directory',
    price: '£2,000 / month + VAT',
    bullets: [
      'Exclusive “Powered by” hero at the top of /events/ — one partner at a time',
      'Logo and link in the header of every attendee email we send — 21 templates (confirmations, reminders, cancellations and more)',
      'Estimated attendee email reach 4,000 – 12,000 / mo (guide range — not guaranteed)',
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
      'Logo in the header of every organiser email we send — 21 templates (registrations, applications, payouts and more)',
      'Estimated organiser email reach 2,000 – 6,000 / mo (guide range — not guaranteed)',
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
      'Logo in the header of every opportunity email we send — 11 templates (listing live, enquiries, expiry and more)',
      'Estimated opportunity email reach 1,200 – 3,500 / mo (guide range — not guaranteed)',
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

/** 3-month Premium Spotlight is bundled with the directory listing launch offer (even if boost isn’t ticked). */
function hasOpportunitySpotlightLaunchOffer(placements) {
  const list = placements || [];
  return (
    list.indexOf('featured_opportunity_boost') !== -1 ||
    list.indexOf('opportunity_directory_listing') !== -1
  );
}

function applyOpportunityLaunchOfferToSection(key, section, companyName) {
  const co = companyName || 'your brand';
  if (key === 'opportunity_directory_listing') {
    section.price = 'Included — 12 months at no charge (worth £300 + VAT)';
    section.intro =
      'Complimentary launch partnership for ' +
      co +
      ': a full business opportunity directory listing on /opportunities/ with member enquiries routed to you — normally £25/month + VAT, waived for the first year.' +
      (section.intro ? ' ' + section.intro : '');
    section.bullets = [
      '12 months directory listing at no subscription charge (normally £25/month + VAT)',
      'Bundled: 3 months Premium Spotlight on /opportunities/ at no charge (normally £55 per boost)',
      'Dedicated profile page + full search visibility across /opportunities/',
      'Member enquiries routed to your listing owner — no per-lead fee',
      'After month 12, continue at the published rate or pause — Headline Sponsor remains a separate optional upgrade',
    ];
  }
  if (key === 'featured_opportunity_boost') {
    section.price = 'Included — 3 months Premium Spotlight (worth £165 + VAT)';
    section.intro =
      'Complimentary launch partnership for ' +
      co +
      ': stay in the Premium Spotlight carousel on /opportunities/ for three months at no charge (normally £55 per ~30-day boost).' +
      (section.intro ? ' ' + section.intro : '');
    section.bullets = [
      '3 months of Premium Spotlight carousel placement at no charge',
      'Featured badge & card highlighting for max click-through',
      'We schedule the three spotlight windows in Command Centre — no Stripe checkout for this launch offer',
      'Stacks with the directory listing — ideal when franchise and partnership offers need visibility fast',
    ];
  }
  return section;
}

function headlineEmailTiles(inventory) {
  if (!inventory || !inventory.count) return [];
  const tiles = [
    {
      title: inventory.count + ' emails',
      body:
        'Linked logo in ' +
        String(inventory.shortLabel || 'matching emails').toLowerCase() +
        ' — confirmations, reminders, updates and more',
    },
  ];
  if (inventory.reach && inventory.reach.emailRange) {
    tiles.push({
      title: inventory.reach.emailRange,
      body:
        (inventory.reach.emailLabel || 'Email reach') +
        ' · guide range, not guaranteed',
    });
  }
  return tiles;
}

function buildEmailTallySection(placements, companyName) {
  const tally = tallyEmailInventories(placements);
  if (!tally.parts.length) return null;
  const co = companyName || 'your brand';
  const bullets = tally.parts.map(function (part) {
    return (
      part.shortLabel +
      ': ' +
      part.count +
      ' templates' +
      (part.reach && part.reach.emailRange ? ' · est. ' + part.reach.emailRange : '')
    );
  });
  if (tally.parts.length > 1) {
    bullets.unshift(
      'Combined Headline email inventory for this deck: ' +
        tally.total +
        ' templates across ' +
        tally.parts.length +
        ' directories'
    );
  }
  return {
    id: 'sponsor_email_inventory',
    navLabel: 'Emails',
    kicker: 'Inbox tally',
    title: 'Email inventory included for ' + co,
    intro:
      tally.parts.length === 1
        ? 'Headline Sponsor includes your logo in every matching transactional email in that directory — tallied below from the live /advertising rate card.'
        : 'Selected Headline packages stack their email inventories. Totals below match the live /advertising rate card.',
    bullets: bullets,
    price: '',
    tiles: [
      {
        title: String(tally.total),
        body:
          tally.parts.length === 1
            ? 'Email templates with your Headline Sponsor logo'
            : 'Email templates across selected Headline packages',
      },
    ].concat(
      tally.parts.map(function (part) {
        return {
          title: part.count + ' · ' + part.shortLabel,
          body: part.label,
        };
      })
    ),
    quote: '',
    emailInventory: {
      tally: true,
      total: tally.total,
      parts: tally.parts,
    },
  };
}

function buildSectionForPlacement(key, companyName, brief, applyLaunch) {
  const co = companyName || 'your brand';
  const briefBit = brief ? String(brief).trim() : '';
  const p = SPONSORSHIP_PLACEMENT_CATALOG[key];
  if (!p) return null;
  let intro = 'Why this fits ' + co + '.';
  if (briefBit) intro += ' ' + briefBit;
  const emailInventory = emailInventoryForPlacement(key);
  const section = {
    id: 'sponsor_' + key,
    navLabel: p.nav,
    kicker: p.kicker,
    title: p.title,
    intro: intro,
    bullets: (p.bullets || []).slice(),
    price: p.price || '',
    tiles: headlineEmailTiles(emailInventory),
    quote: '',
  };
  if (emailInventory) section.emailInventory = emailInventory;
  if (applyLaunch) {
    applyOpportunityLaunchOfferToSection(key, section, co);
  }
  return section;
}

function buildSponsorshipSections(placements, companyName, brief, options) {
  const applyLaunch =
    !options || options.applyOpportunityLaunchOffer !== false;
  const ordered = orderPlacementsForLaunchOffer(placements || []);
  const sections = ordered
    .map(function (key) {
      return buildSectionForPlacement(key, companyName, brief, applyLaunch);
    })
    .filter(Boolean);

  if (
    applyLaunch &&
    ordered.indexOf('opportunity_directory_listing') !== -1 &&
    ordered.indexOf('featured_opportunity_boost') === -1
  ) {
    const spotlight = buildSectionForPlacement(
      'featured_opportunity_boost',
      companyName,
      brief,
      applyLaunch
    );
    const listingIdx = sections.findIndex(function (s) {
      return s && s.id === 'sponsor_opportunity_directory_listing';
    });
    if (listingIdx >= 0) sections.splice(listingIdx + 1, 0, spotlight);
    else sections.push(spotlight);
  }

  // Soft-label Headline sections as optional scale-up when a launch listing offer leads the deck.
  if (applyLaunch && hasOpportunityListingLaunchOffer(ordered)) {
    sections.forEach(function (sec) {
      if (!sec || !/^sponsor_headline_/.test(String(sec.id || ''))) return;
      sec.kicker = 'Optional scale-up';
      if (sec.intro && !/optional upgrade|scale-up/i.test(sec.intro)) {
        sec.intro =
          'Optional upgrade after the free listing is live — not required to claim the launch partnership. ' +
          sec.intro;
      }
    });
  }

  const emailTally = buildEmailTallySection(ordered, companyName);
  if (emailTally) {
    // Place tally after the first Headline package section so the count is obvious early.
    let insertAt = sections.findIndex(function (s) {
      return /^sponsor_headline_/.test(String(s.id || ''));
    });
    if (insertAt === -1) insertAt = 0;
    else insertAt += 1;
    sections.splice(insertAt, 0, emailTally);
  }

  return sections;
}

/**
 * Attach / refresh email inventory tallies on an existing saved deck (no copy rewrite).
 * Keeps edited wording; fills missing counts, lists, and the Emails summary section.
 */
function enrichDeckWithEmailInventory(deck) {
  if (!deck || typeof deck !== 'object') return deck;
  const placements = normalizeSponsorshipPlacements(
    deck.sponsorshipPlacements || deck.sponsorship_placements || []
  );
  if (!placements.length && Array.isArray(deck.sections)) {
    deck.sections.forEach(function (sec) {
      const id = String((sec && sec.id) || '');
      const m = id.match(/^sponsor_(headline_[a-z_]+)$/);
      if (m && placements.indexOf(m[1]) === -1 && HEADLINE_EMAIL_INVENTORIES[m[1]]) {
        placements.push(m[1]);
      }
    });
  }
  if (!Array.isArray(deck.sections)) deck.sections = [];

  deck.sections = deck.sections.map(function (sec) {
    if (!sec || typeof sec !== 'object') return sec;
    const id = String(sec.id || '');
    const m = id.match(/^sponsor_(headline_[a-z_]+)$/);
    if (!m) return sec;
    const inv = emailInventoryForPlacement(m[1]);
    if (!inv) return sec;
    const next = Object.assign({}, sec, { emailInventory: inv });
    if (!Array.isArray(next.tiles) || !next.tiles.length) {
      next.tiles = headlineEmailTiles(inv);
    }
    return next;
  });

  const tallySection = buildEmailTallySection(placements, (deck.hero && deck.hero.preparedFor) || '');
  if (tallySection) {
    const existingIdx = deck.sections.findIndex(function (s) {
      return s && s.id === 'sponsor_email_inventory';
    });
    if (existingIdx >= 0) {
      // Refresh tally numbers; keep a custom title/intro if the sales team edited them.
      const prev = deck.sections[existingIdx];
      deck.sections[existingIdx] = Object.assign({}, tallySection, {
        title: prev.title || tallySection.title,
        intro: prev.intro || tallySection.intro,
      });
    } else {
      let insertAt = deck.sections.findIndex(function (s) {
        return s && /^sponsor_headline_/.test(String(s.id || ''));
      });
      if (insertAt === -1) insertAt = Math.min(1, deck.sections.length);
      else insertAt += 1;
      deck.sections.splice(insertAt, 0, tallySection);
    }
  }

  return deck;
}

function launchOfferHeroChips(placements) {
  const chips = [];
  if (hasOpportunityListingLaunchOffer(placements)) {
    chips.push('12 months listing included');
  }
  if (hasOpportunitySpotlightLaunchOffer(placements)) {
    chips.push('3 months Premium Spotlight included');
  }
  if (chips.length) {
    chips.push('Launch package worth £465 + VAT');
    chips.push('Launch partnership offer');
  }
  return chips;
}

/** Lead with zero-risk listing/spotlight before Headline upsells when the launch offer is in play. */
function orderPlacementsForLaunchOffer(placements) {
  const list = Array.isArray(placements) ? placements.slice() : [];
  if (!hasOpportunityListingLaunchOffer(list)) return list;
  const leadKeys = ['opportunity_directory_listing', 'featured_opportunity_boost'];
  const lead = leadKeys.filter(function (key) {
    return list.indexOf(key) !== -1;
  });
  const rest = list.filter(function (key) {
    return leadKeys.indexOf(key) === -1;
  });
  return lead.concat(rest);
}

module.exports = {
  SPONSORSHIP_PLACEMENT_CATALOG,
  SPONSORSHIP_PLACEMENT_ORDER,
  HEADLINE_EMAIL_INVENTORIES,
  DECK_TYPES,
  normalizeDeckType,
  normalizeSponsorshipPlacements,
  buildSponsorshipSections,
  emailInventoryForPlacement,
  tallyEmailInventories,
  enrichDeckWithEmailInventory,
  hasOpportunityListingLaunchOffer,
  hasOpportunitySpotlightLaunchOffer,
  launchOfferHeroChips,
  orderPlacementsForLaunchOffer,
};
