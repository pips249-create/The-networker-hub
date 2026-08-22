/**
 * Canonical meta for public static pages (home, browse, content).
 */
const { siteOrigin } = require('./hubert-seo');
const { GUIDE_PAGES, GUIDES_HUB, getGuidePageKeys, guideSchemaKey } = require('./guide-pages');

const STATIC_PAGES = {
  home: {
    path: '/',
    title: 'Find events, organiser pages & opportunities – The Networker Hub',
    description:
      'Browse UK networking events, organiser pages, and business opportunities in one place. Free on The Networker Hub; sign up when you\'re ready to book or enquire.',
    image: '/assets/logo.png',
    ogType: 'website',
  },
  events: {
    path: '/events/',
    title: 'Find your next event – The Networker Hub',
    description:
      'Find meetings, webinars, workshops, exhibitions, and awards across the UK. Search by breakfast, women only, location, organiser, and more.',
    image: '/assets/logo.png',
    ogType: 'website',
  },
  opportunities: {
    path: '/opportunities/',
    title: 'Find your next business opportunity – The Networker Hub',
    description:
      'Find your next franchise, side hustle, or partnership across the UK. Browse free on The Networker Hub and enquire directly with providers.',
    image: '/assets/logo.png',
    ogType: 'website',
  },
  faq: {
    path: '/faq',
    title: 'FAQ & Help – The Networker Hub',
    description:
      'Frequently asked questions about The Networker Hub — finding events, accounts, organisers, and bookings. Search FAQs or ask Hubert instantly.',
    image: '/assets/logo.png',
    ogType: 'website',
  },
  'help-organiser-payouts': {
    path: '/help/organiser-payouts',
    title: 'Organiser payouts – The Networker Hub',
    description:
      'When organisers receive ticket payouts on The Networker Hub — 7-day settlement, Stripe Connect, archiving events, and requesting payouts from your dashboard.',
    image: '/assets/logo.png',
    ogType: 'article',
  },
  'help-pricing-fees': {
    path: '/help/pricing-fees',
    title: 'Ticket pricing & fees – The Networker Hub',
    description:
      'How The Networker Hub ticket fees work — 4.5% + 20p booking fee paid by attendees, organisers receive the full ticket price, with worked examples.',
    image: '/assets/logo.png',
    ogType: 'article',
  },
  about: {
    path: '/about',
    title: 'About us – The Networker Hub',
    description:
      'Learn about The Networker Hub — the UK platform for networking events, exhibitions, and business opportunities.',
    image: '/assets/logo.png',
    ogType: 'website',
  },
  rankings: {
    path: '/rankings',
    title: 'Networking group leaderboard – The Networker Hub',
    description:
      'See the Top 10, Top 25 and Top 50 networking groups on The Networker Hub — ranked by attendee ratings and review rate each month.',
    image: '/assets/logo.png',
    ogType: 'website',
  },
  'for-organisers': {
    path: '/for-organisers',
    title: 'Find your next attendees – For organisers – The Networker Hub',
    description:
      'Find your next attendees, bookings, and discovery on The Networker Hub. Ticketing built for UK networking groups with tools generic platforms do not offer.',
    image: '/assets/logo.png',
    ogType: 'website',
  },
  'add-your-event': {
    path: '/add-your-event',
    title: 'Send us your event details – The Networker Hub',
    description:
      'Send your networking event details to The Networker Hub — Catherine and Jamie will list it for you.',
    image: '/assets/logo.png',
    ogType: 'website',
  },
  'for-networkers': {
    path: '/for-networkers',
    title: 'Events, Organisers & Business Opportunities – For networkers – The Networker Hub',
    description:
      'UK Events, Organiser pages, and Business Opportunities in one place. Free to join — My Hub, smart alerts, member rates, and booking reminders.',
    image: '/assets/logo.png',
    ogType: 'website',
  },
  /** Legacy key — path redirects to /for-networkers; keep for old data-page attrs. */
  'for-attendees': {
    path: '/for-networkers',
    title: 'Events, Organisers & Business Opportunities – For networkers – The Networker Hub',
    description:
      'UK Events, Organiser pages, and Business Opportunities in one place. Free to join — My Hub, smart alerts, member rates, and booking reminders.',
    image: '/assets/logo.png',
    ogType: 'website',
  },
  contact: {
    path: '/contact',
    title: 'Contact us – The Networker Hub',
    description:
      'Get in touch with The Networker Hub — chat with Hubert, your business butler and concierge, or email the team.',
    image: '/assets/logo.png',
    ogType: 'website',
  },
  advertising: {
    path: '/advertising',
    title: 'Advertising & sponsorship – The Networker Hub',
    description:
      'Promote your brand on The Networker Hub — sponsor the events directory, business opportunities, and event page placements.',
    image: '/assets/logo.png',
    ogType: 'website',
  },
  legal: {
    path: '/legal-policies',
    title: 'Legal & policies – The Networker Hub',
    description:
      'Privacy policy, terms and conditions, refunds, cookie policy and legal information for The Networker Hub — operated by The Networker Group Ltd.',
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
