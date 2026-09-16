/**
 * Build tailored organiser sales pitch deck JSON (template + optional OpenAI polish).
 */
const crypto = require('crypto');
const {
  normalizeDeckType,
  normalizeSponsorshipPlacements,
  buildSponsorshipSections,
  SPONSORSHIP_PLACEMENT_ORDER,
} = require('./sponsorship-pitch-catalog');

const SECTION_CATALOG = {
  opening: { nav: 'Opening', kicker: 'Start here' },
  problem: { nav: 'The problem', kicker: 'Pain today' },
  discovery: { nav: 'Discovery', kicker: 'Get found' },
  dashboard: { nav: 'Dashboard', kicker: 'Your workspace' },
  tools: { nav: 'Tools', kicker: 'Networking-only' },
  pricing: { nav: 'Pricing', kicker: 'Commercials' },
  objections: { nav: 'Objections', kicker: 'Pushback' },
  next_steps: { nav: 'Next steps', kicker: 'Close' },
};

const DEFAULT_SECTIONS = [
  'opening',
  'problem',
  'discovery',
  'dashboard',
  'tools',
  'pricing',
  'objections',
  'next_steps',
];

function cleanText(value, max) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, max || 8000);
}

function normalizeWebsite(raw) {
  const w = cleanText(raw, 500);
  if (!w) return '';
  if (/^https?:\/\//i.test(w)) return w;
  return 'https://' + w.replace(/^\/+/, '');
}

function hostFromWebsite(website) {
  try {
    return new URL(normalizeWebsite(website)).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

function normalizeSections(raw, opts) {
  const list = Array.isArray(raw) ? raw : [];
  const out = [];
  list.forEach(function (key) {
    const k = String(key || '').trim();
    if (SECTION_CATALOG[k] && out.indexOf(k) === -1) out.push(k);
  });
  if (!out.length) {
    return opts && opts.allowEmpty ? [] : DEFAULT_SECTIONS.slice();
  }
  return out;
}

function sponsorshipOpeningSection(companyName, brief) {
  const co = cleanText(companyName, 120) || 'your brand';
  const briefBit = cleanText(brief, 400);
  return {
    id: 'sponsor_opening',
    navLabel: 'Opening',
    kicker: 'Partnerships',
    title: 'Opening the conversation with ' + co,
    intro:
      'Confirm who they want to reach (event bookers, group owners, opportunity seekers), budget, and timing — then map packages from /advertising.' +
      (briefBit ? ' Focus: ' + briefBit : ''),
    bullets: [
      'Who is the target buyer — business owners, franchisees, professionals booking events?',
      'Which parts of the site matter most — Events, Organisers, or Opportunities?',
      'Monthly vs prepaid commitment — most packages offer 1–12 month terms',
      'Any category exclusivity or geographic focus (city / county)?',
    ],
    tiles: [],
    quote: '',
  };
}

function sponsorshipNextStepsSection(companyName) {
  const co = cleanText(companyName, 120) || 'your brand';
  return {
    id: 'sponsor_next_steps',
    navLabel: 'Next steps',
    kicker: 'Close',
    title: 'Recommended next steps for ' + co,
    intro: 'Keep momentum while inventory and eligibility are fresh.',
    bullets: [
      'Confirm placement list and start dates (or enquiry for Headline / Industry slots)',
      'Share logo assets and landing URL for creative',
      'For self-serve: City / County Sponsor or Featured Boost checkout on /advertising',
      'Book a 15-minute walkthrough of live placements on the site',
    ],
    tiles: [],
    quote: '',
  };
}

function makeDeckSlug(companyName) {
  const base =
    String(companyName || 'group')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 28) || 'group';
  const suffix = crypto.randomBytes(3).toString('hex');
  return 'custom-' + base + '-' + suffix;
}

function sectionTemplates(companyName, website, brief) {
  const host = hostFromWebsite(website);
  const co = companyName || 'your group';
  const briefBit = brief ? cleanText(brief, 400) : '';

  return {
    opening: {
      id: 'opening',
      title: 'Opening the conversation with ' + co,
      intro:
        'Mirror how they run events today, then position The Networker UK as built for UK networking — not generic ticketing.' +
        (briefBit ? ' Focus: ' + briefBit : ''),
      bullets: [
        'How do new people find and book your meetings today?',
        'Do you offer guest or trial visits before paid membership?',
        'How do you handle member-only pricing — access codes, spreadsheets, manual lists?',
        'What hurts most: filling seats, admin, converting guests, or getting found?',
      ],
      quote:
        'We built The Networker UK because generic ticketing platforms were not built for how UK networking groups grow — trial visits, member rates, curated rooms, and repeat attendance.',
    },
    problem: {
      id: 'problem',
      title: 'Why ' + co + ' feels the pain',
      intro:
        'Generic event platforms optimise for one-off ticket sales. Networking groups need discovery, guest conversion, and member access without spreadsheet admin.',
      bullets: [
        'New attendees struggle to find you outside your existing WhatsApp or LinkedIn circle',
        'Member rates often mean access codes, manual lists, or chasing payments offline',
        'You cannot always see who is on their first visit versus returning',
        'Promoting each meeting across channels takes time you do not have',
      ],
    },
    discovery: {
      id: 'discovery',
      title: 'Where ' + co + ' gets discovered',
      intro:
        'List on the UK directory networkers already browse — alongside reviews, maps, and organiser profiles.',
      bullets: [
        'Events, groups, and opportunities in one search with city and date filters',
        'Public organiser page with reviews and upcoming meetings',
        'Guest visit and register-interest flows so prospects try before they commit',
        host ? 'Send people to your site (' + host + ') from your profile when you are ready' : 'Link your website from your organiser profile',
      ],
    },
    dashboard: {
      id: 'dashboard',
      title: co + "'s organiser workspace",
      intro: 'One dashboard for listings, bookings, attendees, and promote tools — built for repeat meetings.',
      bullets: [
        'Publish events in minutes — free and paid tickets, online or in-person',
        'Attendee list with visit tracking (first visit vs returning)',
        'Team editors so co-hosts are not sharing one login',
        'Stripe payouts when you are ready; free events need no setup',
      ],
    },
    tools: {
      id: 'tools',
      title: 'Tools generic platforms skip',
      intro: 'Five networking-specific features ' + co + ' can turn on as you grow.',
      tiles: [
        { title: 'Guest visits', body: 'Complimentary trial visits before paid member tickets' },
        { title: 'Visit tracking', body: 'See first visit vs returning on every attendee list' },
        { title: 'Category exclusivity', body: 'Approve who is in the room before payment' },
        { title: 'Previous attendees', body: 'Invite-only loyalty rates on repeat events' },
        { title: 'Membership register', body: 'Member-only tickets without access codes' },
      ],
    },
    pricing: {
      id: 'pricing',
      title: 'Free to list. Keep 100%.',
      intro: 'No monthly subscription for events on The Networker UK.',
      bullets: [
        'You receive the full ticket price you set',
        'Attendees pay 4.5% + 20p booking fee at checkout',
        'Free events need no Stripe setup',
        'Optional Premium Spotlight when you want extra visibility',
        'Works alongside Eventbrite during a transition month',
      ],
    },
    objections: {
      id: 'objections',
      title: 'Low-risk to try',
      intro: 'Short answers when ' + co + ' pushes back.',
      bullets: [
        '"We are on Eventbrite." — List both for a month and compare admin time and new bookings',
        '"Members will not sign up." — Browse is free; booking takes about two minutes',
        '"We have a CRM." — Keep it for renewals; use The Networker UK for booking visibility',
        '"What is the catch?" — None on listing; attendees pay the booking fee',
      ],
    },
    next_steps: {
      id: 'next_steps',
      title: 'Let us list ' + co + "'s next meeting",
      intro: 'Concrete steps you can agree on the call.',
      bullets: [
        'Claim the organiser page — ten minutes together',
        'Publish the next 2–3 dates',
        'Turn on guest visits or upload the member list',
        'Review bookings and visit tracking after the first event',
      ],
    },
  };
}

function buildOrganiserHero(companyName, website, brief, prospectLogoUrl) {
  const co = cleanText(companyName, 120) || 'Your group';
  const host = hostFromWebsite(website);
  const logo = cleanText(prospectLogoUrl, 2000);
  return {
    preparedFor: co,
    website: normalizeWebsite(website),
    websiteLabel: host || '',
    prospectLogoUrl: logo,
    deckType: 'organiser',
    headline: 'Move ' + co + ' to The Networker UK',
    lede:
      cleanText(brief, 320) ||
      'Ticketing and discovery built for UK networking groups — free to list, you keep 100% of the ticket price, with tools generic platforms do not offer.',
    chips: ['Free to list', 'Keep 100% of ticket price', 'Built for networking groups'],
  };
}

function buildSponsorshipHero(companyName, website, brief, prospectLogoUrl) {
  const co = cleanText(companyName, 120) || 'Your brand';
  const host = hostFromWebsite(website);
  const logo = cleanText(prospectLogoUrl, 2000);
  return {
    preparedFor: co,
    website: normalizeWebsite(website),
    websiteLabel: host || '',
    prospectLogoUrl: logo,
    deckType: 'sponsorship',
    headline: 'Advertising on The Networker UK for ' + co,
    lede:
      cleanText(brief, 320) ||
      'Reach business owners, event bookers, and opportunity seekers across our Events, Organisers, and Business Opportunities directories — with exclusive and self-serve placements.',
    chips: ['Events · Organisers · Opportunities', 'Headline & page partners', 'Listings from £25/mo + VAT'],
  };
}

function buildCombinedHero(companyName, website, brief, prospectLogoUrl) {
  const hero = buildOrganiserHero(companyName, website, brief, prospectLogoUrl);
  hero.deckType = 'combined';
  hero.headline = coHeadlineCombined(cleanText(companyName, 120));
  hero.lede =
    cleanText(brief, 320) ||
    'Cover organiser ticketing plus sponsorship placements — tailored to how ' +
      (cleanText(companyName, 120) || 'this partner') +
      ' wants to grow on The Networker UK.';
  hero.chips = ['Organiser tools', 'Sponsorship inventory', 'One partnership conversation'];
  return hero;
}

function coHeadlineCombined(companyName) {
  const co = companyName || 'your partner';
  return 'The Networker UK partnership plan for ' + co;
}

function buildOrganiserSections(companyName, website, brief, includeSections) {
  const sections = normalizeSections(includeSections);
  const templates = sectionTemplates(companyName, website, brief);
  return sections.map(function (key) {
    const t = templates[key];
    const meta = SECTION_CATALOG[key];
    return {
      id: key,
      navLabel: meta.nav,
      kicker: meta.kicker,
      title: t.title,
      intro: t.intro,
      bullets: t.bullets || [],
      tiles: t.tiles || [],
      quote: t.quote || '',
    };
  });
}

function orderSponsorshipPlacements(placements) {
  const set = {};
  placements.forEach(function (k) {
    set[k] = true;
  });
  return SPONSORSHIP_PLACEMENT_ORDER.filter(function (k) {
    return set[k];
  });
}

function buildDeckFromTemplate(input) {
  const companyName = cleanText(input.companyName, 120);
  const website = normalizeWebsite(input.website);
  const brief = cleanText(input.brief, 4000);
  const prospectLogoUrl = cleanText(input.prospectLogoUrl, 2000);
  const deckType = normalizeDeckType(input.deckType);
  const sponsorshipPlacements = orderSponsorshipPlacements(
    normalizeSponsorshipPlacements(input.sponsorshipPlacements)
  );

  const deckSections = [];
  let hero;
  let close;

  if (deckType === 'sponsorship') {
    hero = buildSponsorshipHero(companyName, website, brief, prospectLogoUrl);
    close = { headline: 'Explore placements', url: 'thenetworkeruk.com/advertising' };
    deckSections.push(sponsorshipOpeningSection(companyName, brief));
    deckSections.push.apply(
      deckSections,
      buildSponsorshipSections(sponsorshipPlacements, companyName, brief)
    );
    deckSections.push(sponsorshipNextStepsSection(companyName));
  } else if (deckType === 'combined') {
    hero = buildCombinedHero(companyName, website, brief, prospectLogoUrl);
    close = { headline: 'Let\'s get you live', url: 'thenetworkeruk.com/advertising' };
    deckSections.push(sponsorshipOpeningSection(companyName, brief));
    deckSections.push.apply(
      deckSections,
      buildSponsorshipSections(sponsorshipPlacements, companyName, brief)
    );
    deckSections.push.apply(
      deckSections,
      buildOrganiserSections(companyName, website, brief, input.includeSections)
    );
  } else {
    hero = buildOrganiserHero(companyName, website, brief, prospectLogoUrl);
    close = { headline: 'Find your next attendees', url: 'thenetworkeruk.com/for-organisers' };
    deckSections.push.apply(
      deckSections,
      buildOrganiserSections(companyName, website, brief, input.includeSections)
    );
  }

  return {
    version: 1,
    deckType,
    sponsorshipPlacements,
    hero,
    sections: deckSections,
    close,
  };
}

async function polishDeckWithOpenAI(deck, input) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return deck;

  const model = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';
  const system =
    'You tailor internal B2B sales pitch decks for The Networker UK (networking ticketing + advertising). ' +
    'Return ONLY valid JSON matching the input shape: { hero, sections, close, deckType, sponsorshipPlacements }. ' +
    'Keep section ids unchanged. Improve wording to reference the prospect company naturally. ' +
    'Do not invent pricing beyond published packages: Headline Sponsor ~£2k/mo, Page Partner ~£600/mo, Featured Boost £55, City from £29/mo, County from £49/mo, opportunity listing £25/mo + VAT, organiser free to list / keep 100% ticket / attendees 4.5%+20p.';

  const userPayload = {
    companyName: input.companyName,
    website: input.website,
    brief: input.brief,
    deck,
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      max_tokens: 2500,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(function () {
      return '';
    });
    console.warn('custom-pitch-deck OpenAI', res.status, errText.slice(0, 200));
    return deck;
  }

  const data = await res.json();
  const raw =
    data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!raw) return deck;

  try {
    const parsed = JSON.parse(String(raw));
    if (parsed && parsed.hero && Array.isArray(parsed.sections)) {
      parsed.version = 1;
      return parsed;
    }
  } catch (e) {
    console.warn('custom-pitch-deck OpenAI parse', e && e.message);
  }
  return deck;
}

async function generateCustomPitchDeck(input) {
  const base = buildDeckFromTemplate(input || {});
  try {
    return await polishDeckWithOpenAI(base, input || {});
  } catch (e) {
    console.warn('custom-pitch-deck generate', e && e.message);
    return base;
  }
}

function publicPathForSlug(slug) {
  return '/p-tnh-' + String(slug || '').trim();
}

function validatePitchDeckInput(input) {
  const deckType = normalizeDeckType(input && input.deckType);
  const placements = normalizeSponsorshipPlacements(input && input.sponsorshipPlacements);
  if ((deckType === 'sponsorship' || deckType === 'combined') && !placements.length) {
    return {
      ok: false,
      message: 'Pick at least one sponsorship placement (e.g. Headline Sponsor or business opportunity listing).',
    };
  }
  return { ok: true, deckType, placements };
}

module.exports = {
  SECTION_CATALOG,
  DEFAULT_SECTIONS,
  makeDeckSlug,
  normalizeSections,
  normalizeWebsite,
  cleanText,
  generateCustomPitchDeck,
  publicPathForSlug,
  validatePitchDeckInput,
};
