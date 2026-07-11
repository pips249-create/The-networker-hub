/**
 * Canonical meta for public static pages (home, browse, content).
 */
const { siteOrigin } = require('./hubert-seo');

const STATIC_PAGES = {
  home: {
    path: '/',
    title: 'The Networker Hub — Events & business opportunities',
    description:
      'Browse UK networking events and business opportunities for free. Create a free account to buy tickets or send enquiries — it only takes 2 minutes.',
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
    title: 'Browse business opportunities – The Networker Hub',
    description:
      'Browse franchises, side hustles, partnerships and business opportunities across the UK network — free to search on The Networker Hub.',
    image: '/assets/logo.png',
    ogType: 'website',
  },
  faq: {
    path: '/faq.html',
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
    path: '/about.html',
    title: 'About us – The Networker Hub',
    description:
      'Learn about The Networker Hub — the UK platform for networking events, exhibitions, and business opportunities.',
    image: '/assets/logo.png',
    ogType: 'website',
  },
  'for-organisers': {
    path: '/for-organisers.html',
    title: 'For Organisers – The Networker Hub',
    description:
      'List UK networking events and business opportunities — organiser dashboard, guest visits, visit tracking, Category Exclusivity, Alumni Fast-Pass, and member discovery.',
    image: '/assets/logo.png',
    ogType: 'website',
  },
  contact: {
    path: '/contact.html',
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
    path: '/legal-policies.html',
    title: 'Legal & policies – The Networker Hub',
    description:
      'Privacy policy, terms and conditions, refunds, cookie policy and legal information for The Networker Hub — operated by The Networker Group Ltd.',
    image: '/assets/logo.png',
    ogType: 'website',
  },
};

function absoluteUrl(origin, path) {
  const base = siteOrigin(origin);
  const p = String(path || '').startsWith('/') ? path : '/' + path;
  return base + p;
}

function getStaticPageKeys() {
  return Object.keys(STATIC_PAGES);
}

function getStaticPageConfig(pageKey) {
  return STATIC_PAGES[String(pageKey || '').toLowerCase()] || null;
}

module.exports = {
  STATIC_PAGES,
  getStaticPageKeys,
  getStaticPageConfig,
  absoluteUrl,
};
