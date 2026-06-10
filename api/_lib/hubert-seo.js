/**
 * JSON-LD schema builders — sourced from Hubert knowledge for SEO & AEO.
 */
const { FAQ_AEO_ENTRIES } = require('./hubert-faq');

const SITE_NAME = 'The Networker Hub';
const LEGAL_NAME = 'The Networker Group Ltd';
const DEFAULT_ORIGIN = 'https://the-networker.co.uk';

function siteOrigin(override) {
  const raw = String(override || process.env.SITE_URL || DEFAULT_ORIGIN).trim();
  return raw.replace(/\/$/, '');
}

function buildOrganizationSchema(origin) {
  const base = siteOrigin(origin);
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    legalName: LEGAL_NAME,
    url: base,
    logo: base + '/assets/logo.png',
    image: base + '/assets/logo.png',
    email: 'hello@the-networker.co.uk',
    description:
      'UK platform for networking events, exhibitions, business opportunities, and professional training.',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Magpas HQ, Barnwell Road, Alconbury Weald',
      addressLocality: 'Huntingdon',
      addressRegion: 'Cambridgeshire',
      postalCode: 'PE28 4YF',
      addressCountry: 'GB',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'hello@the-networker.co.uk',
      availableLanguage: ['English'],
    },
    founder: [
      { '@type': 'Person', name: 'Rosie' },
      { '@type': 'Person', name: 'Catherine Hancher', alternateName: 'Pip' },
    ],
  };
}

function buildWebSiteSchema(origin) {
  const base = siteOrigin(origin);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: base,
    description:
      'Browse UK networking events, business opportunities, and training. Free to explore; create a free account to buy tickets or send enquiries.',
    publisher: {
      '@type': 'Organization',
      name: LEGAL_NAME,
      url: base,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: base + '/events/?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

function buildFaqPageSchema(entries, origin) {
  const base = siteOrigin(origin);
  const list = entries || FAQ_AEO_ENTRIES;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': base + '/faq.html#faq',
    url: base + '/faq.html',
    name: 'The Networker Hub — Frequently asked questions',
    mainEntity: list.map(function (item) {
      return {
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      };
    }),
  };
}

function buildHubertSchema(origin) {
  const base = siteOrigin(origin);
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Hubert',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: base + '/contact.html',
    description:
      'Hubert is the business butler and concierge for The Networker Hub — an AI assistant that helps users find events and business opportunities, understand ticketing and enquiries, and navigate organiser tools.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'GBP',
    },
    provider: {
      '@type': 'Organization',
      name: LEGAL_NAME,
      url: base,
    },
  };
}

function buildContactPageSchema(origin) {
  const base = siteOrigin(origin);
  return {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    '@id': base + '/contact.html',
    url: base + '/contact.html',
    name: 'Contact The Networker Hub',
    description:
      'Contact The Networker Hub or chat with Hubert, your business butler and concierge, for help with events, tickets, and business opportunities.',
    mainEntity: buildHubertSchema(base),
  };
}

function buildSchemaGraph(page, origin) {
  const base = siteOrigin(origin);
  const graph = [buildOrganizationSchema(base)];

  if (page === 'home') {
    graph.push(buildWebSiteSchema(base));
    graph.push(buildFaqPageSchema(FAQ_AEO_ENTRIES.slice(0, 6), base));
  } else if (page === 'faq') {
    graph.push(buildFaqPageSchema(FAQ_AEO_ENTRIES, base));
  } else if (page === 'contact') {
    graph.push(buildContactPageSchema(base));
    graph.push(buildHubertSchema(base));
  } else if (page === 'about') {
    graph.push({
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      url: base + '/about.html',
      name: 'About The Networker Hub',
      description:
        'The Networker Hub connects UK business owners and professionals with networking events, exhibitions, and training.',
      mainEntity: buildOrganizationSchema(base),
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

function buildLlmsTxt(origin) {
  const base = siteOrigin(origin);
  const faqBlock = FAQ_AEO_ENTRIES.map(function (item) {
    return '## ' + item.question + '\n' + item.answer;
  }).join('\n\n');

  return (
    '# The Networker Hub\n' +
    '> UK business networking platform — events, business opportunities, and training (The Academy).\n\n' +
    'Operated by The Networker Group Ltd (Company No. 15252227). Contact: hello@the-networker.co.uk\n\n' +
    '## Canonical URLs\n' +
    '- Home: ' +
    base +
    '/\n' +
    '- Events: ' +
    base +
    '/events/\n' +
    '- Business opportunities: ' +
    base +
    '/opportunities/\n' +
    '- Training (Academy preview): ' +
    base +
    '/training/\n' +
    '- FAQ: ' +
    base +
    '/faq.html\n' +
    '- Contact (Hubert assistant): ' +
    base +
    '/contact.html\n' +
    '- About: ' +
    base +
    '/about.html\n' +
    '- Legal: ' +
    base +
    '/legal-policies.html\n\n' +
    '## Hubert — business butler & concierge\n' +
    'Hubert is the on-site AI assistant. He answers questions about browsing, accounts, tickets, opportunities, and organiser tools. He can look up live published events and business opportunities when asked.\n\n' +
    '## Frequently asked questions\n\n' +
    faqBlock +
    '\n'
  );
}

module.exports = {
  SITE_NAME,
  DEFAULT_ORIGIN,
  siteOrigin,
  buildOrganizationSchema,
  buildWebSiteSchema,
  buildFaqPageSchema,
  buildHubertSchema,
  buildContactPageSchema,
  buildSchemaGraph,
  buildLlmsTxt,
  FAQ_AEO_ENTRIES,
};
