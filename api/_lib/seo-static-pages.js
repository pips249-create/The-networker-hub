/**
 * Canonical meta for public static pages (home, browse, content).
 */
const { siteOrigin } = require('./hubert-seo');
const { GUIDE_PAGES, GUIDES_HUB, getGuidePageKeys, guideSchemaKey } = require('./guide-pages');

const STATIC_PAGES = {
  home: {
    path: '/',
    title: 'Find events, organiser pages & opportunities – The Networker UK',
    description:
      'Browse UK networking events, organiser pages, and business opportunities in one place. Free on The Networker UK; sign up when you\'re ready to book or enquire.',
    image: '/assets/logo.png',
    ogType: 'website',
  },
  events: {
    path: '/events/',
    title: 'Find your next event – The Networker UK',
    description:
      'Find meetings, webinars, workshops, exhibitions, and awards across the UK. Search by breakfast, women only, location, organiser, and more.',
    image: '/assets/logo.png',
    ogType: 'website',
  },
  opportunities: {
    path: '/opportunities/',
    title: 'Find your next business opportunity – The Networker UK',
    description:
      'Find your next franchise, side hustle, or partnership across the UK. Browse free on The Networker UK and enquire directly with providers.',
    image: '/assets/logo.png',
    ogType: 'website',
  },
  faq: {
    path: '/faq',
    title: 'FAQ & Help – The Networker UK',
    description:
      'Frequently asked questions about The Networker UK — finding events, accounts, organisers, and bookings. Search FAQs or ask Hubert instantly.',
    image: '/assets/logo.png',
    ogType: 'website',
  },
  'help-organiser-payouts': {
    path: '/help/organiser-payouts',
    title: 'Organiser payouts – The Networker UK',
    description:
      'When organisers receive ticket payouts on The Networker UK — 7-day settlement, Stripe Connect, archiving events, and requesting payouts from your dashboard.',
    image: '/assets/logo.png',
    ogType: 'article',
  },
  'help-pricing-fees': {
    path: '/help/pricing-fees',
    title: 'Ticket pricing & fees – The Networker UK',
    description:
      'How The Networker UK ticket fees work — 4.5% + 20p booking fee paid by attendees, organisers receive the full ticket price, with worked examples.',
    image: '/assets/logo.png',
    ogType: 'article',
  },
  about: {
    path: '/about',
    title: 'About us – The Networker UK',
    description:
      'Learn about The Networker UK — the UK platform for networking events, exhibitions, and business opportunities.',
    image: '/assets/logo.png',
    ogType: 'website',
  },
  rankings: {
    path: '/rankings',
    title: 'Networking group leaderboard – The Networker UK',
    description:
      'See the Top 10, Top 25 and Top 50 networking groups on The Networker UK — ranked by attendee ratings and review rate each month.',
    image: '/assets/logo.png',
    ogType: 'website',
  },
  'for-organisers': {
    path: '/for-organisers',
    title: 'Find your next attendees – For organisers – The Networker UK',
    description:
      'Find your next attendees, bookings, and discovery on The Networker UK. Ticketing built for UK networking groups with tools generic platforms do not offer.',
    image: '/assets/logo.png',
    ogType: 'website',
  },
  'add-your-event': {
    path: '/add-your-event',
    title: 'Send us your event details – The Networker UK',
    description:
      'Send your networking event details to The Networker UK — Catherine and Jamie will list it for you.',
    image: '/assets/logo.png',
    ogType: 'website',
  },
  'for-networkers': {
    path: '/for-networkers',
    title: 'Events, Organisers & Business Opportunities – For networkers – The Networker UK',
    description:
      'UK Events, Organiser pages, and Business Opportunities in one place. Free to join — My account, smart alerts, member rates, and booking reminders.',
    image: '/assets/logo.png',
    ogType: 'website',
  },
  /** Legacy key — path redirects to /for-networkers; keep for old data-page attrs. */
  'for-attendees': {
    path: '/for-networkers',
    title: 'Events, Organisers & Business Opportunities – For networkers – The Networker UK',
    description:
      'UK Events, Organiser pages, and Business Opportunities in one place. Free to join — My account, smart alerts, member rates, and booking reminders.',
    image: '/assets/logo.png',
    ogType: 'website',
  },
  contact: {
    path: '/contact',
    title: 'Contact us – The Networker UK',
    description:
      'Get in touch with The Networker UK — chat with Hubert, your business butler and concierge, or email the team.',
    image: '/assets/logo.png',
    ogType: 'website',
  },
  advertising: {
    path: '/advertising',
    title: 'Advertising & sponsorship – The Networker UK',
    description:
      'Promote your brand on The Networker UK — sponsor the events directory, business opportunities, and event page placements.',
    image: '/assets/logo.png',
    ogType: 'website',
  },
  legal: {
    path: '/legal-policies',
    title: 'Legal & policies – The Networker UK',
    description:
      'Privacy policy, terms and conditions, refunds, cookie policy and legal information for The Networker UK — operated by The Networker Group Ltd.',
    image: '/assets/logo.png',
    ogType: 'website',
  },
  guides: {
    path: GUIDES_HUB.path,
    title: GUIDES_HUB.title,
    description: GUIDES_HUB.description,
    image: '/assets/logo.png',
    ogType: 'website',
  },
};

getGuidePageKeys().forEach(function (guideKey) {
  const guide = GUIDE_PAGES[guideKey];
  STATIC_PAGES[guideSchemaKey(guideKey)] = {
    path: guide.path,
    title: guide.title,
    description: guide.description,
    image: '/assets/logo.png',
    ogType: 'article',
  };
});

const STATIC_PAGES_EXPORT = STATIC_PAGES;

function absoluteUrl(origin, path) {
  const base = siteOrigin(origin);
  const p = String(path || '').startsWith('/') ? path : '/' + path;
  return base + p;
}

function getStaticPageKeys() {
  return Object.keys(STATIC_PAGES_EXPORT);
}

function getStaticPageConfig(pageKey) {
  return STATIC_PAGES_EXPORT[String(pageKey || '').toLowerCase()] || null;
}

module.exports = {
  STATIC_PAGES: STATIC_PAGES_EXPORT,
  getStaticPageKeys,
  getStaticPageConfig,
  absoluteUrl,
};
