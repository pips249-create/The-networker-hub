/**
 * JSON-LD schema builders — sourced from Hubert knowledge for SEO & AEO.
 */
const { FAQ_AEO_ENTRIES } = require('./hubert-faq');
const { HELP_PAGES } = require('./help-pages');

const SITE_NAME = 'The Networker Hub';
const LEGAL_NAME = 'The Networker Group Ltd';
const DEFAULT_ORIGIN = 'https://www.thenetworkerhub.com';

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
    email: 'hello@thenetworkerhub.com',
    description:
      'UK platform for networking events, exhibitions, and business opportunities.',
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
      email: 'hello@thenetworkerhub.com',
      availableLanguage: ['English'],
    },
    founder: [
      { '@type': 'Person', name: 'Rosie' },
      { '@type': 'Person', name: 'Catherine Hancher' },
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
      'Browse UK networking events and business opportunities. Free to explore; create a free account to buy tickets or send enquiries.',
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
    '@id': base + '/faq#faq',
    url: base + '/faq',
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
    url: base + '/contact',
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

function buildCollectionPageSchema(name, path, description, origin) {
  const base = siteOrigin(origin);
  const url = base + (path.startsWith('/') ? path : '/' + path);
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': url,
    url: url,
    name: name + ' — ' + SITE_NAME,
    description: description,
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: base,
    },
  };
}

function buildBreadcrumbListSchema(items, origin) {
  const base = siteOrigin(origin);
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map(function (item, index) {
      const path = item.path.startsWith('/') ? item.path : '/' + item.path;
      return {
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: base + path,
      };
    }),
  };
}

function stripSchemaContext(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  const copy = Object.assign({}, schema);
  delete copy['@context'];
  return copy;
}

function buildSchemaGraphFromParts(parts, origin) {
  return {
    '@context': 'https://schema.org',
    '@graph': parts.map(stripSchemaContext),
  };
}

function buildContactPageSchema(origin) {
  const base = siteOrigin(origin);
  return {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    '@id': base + '/contact',
    url: base + '/contact',
    name: 'Contact The Networker Hub',
    description:
      'Contact The Networker Hub or chat with Hubert, your business butler and concierge, for help with events, tickets, and business opportunities.',
    mainEntity: buildHubertSchema(base),
  };
}

function buildHowToSchema(guide, origin) {
  const base = siteOrigin(origin);
  const url = base + guide.path;
  return {
    '@type': 'HowTo',
    '@id': url + '#howto',
    url: url,
    name: guide.howToName || guide.name,
    description: guide.description,
    step: guide.steps.map(function (step, index) {
      return {
        '@type': 'HowToStep',
        position: index + 1,
        name: step.name,
        text: step.text,
        url: url + (step.id ? '#' + step.id : ''),
      };
    }),
  };
}

function buildGuideBreadcrumbs(guideName, guidePath, origin) {
  return buildBreadcrumbListSchema(
    [
      { name: 'Home', path: '/' },
      { name: 'Organiser guides', path: '/guides' },
      { name: guideName, path: guidePath },
    ],
    origin
  );
}

function buildHelpBreadcrumbs(helpName, helpPath, origin) {
  return buildBreadcrumbListSchema(
    [
      { name: 'Home', path: '/' },
      { name: 'FAQ & Help', path: '/faq' },
      { name: helpName, path: helpPath },
    ],
    origin
  );
}

function buildGuidePageSchema(guideKey, origin) {
  const { GUIDE_PAGES } = require('./guide-pages');
  const guide = GUIDE_PAGES[guideKey];
  if (!guide) return null;

  const base = siteOrigin(origin);
  const url = base + guide.path;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': url + '#webpage',
        url: url,
        name: guide.title,
        description: guide.description,
        isPartOf: {
          '@type': 'WebSite',
          name: SITE_NAME,
          url: base,
        },
      },
      buildHowToSchema(guide, base),
      buildGuideBreadcrumbs(guide.name, guide.path, base),
    ],
  };
}

function buildGuidesHubSchema(origin) {
  const base = siteOrigin(origin);
  const url = base + '/guides';
  const { GUIDES_HUB } = require('./guide-pages');

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': url,
        url: url,
        name: GUIDES_HUB.title,
        description: GUIDES_HUB.description,
        isPartOf: {
          '@type': 'WebSite',
          name: SITE_NAME,
          url: base,
        },
      },
      buildBreadcrumbListSchema(
        [
          { name: 'Home', path: '/' },
          { name: GUIDES_HUB.name, path: '/guides' },
        ],
        base
      ),
    ],
  };
}

function buildHelpArticleSchema(pageKey, origin) {
  const base = siteOrigin(origin);
  const page = HELP_PAGES[pageKey];
  if (!page) return null;

  const url = base + page.path;
  const headline = page.title.replace(' – The Networker Hub', '');

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': url + '#article',
        url: url,
        headline: headline,
        description: page.description,
        author: {
          '@type': 'Organization',
          name: LEGAL_NAME,
          url: base,
        },
        publisher: {
          '@type': 'Organization',
          name: LEGAL_NAME,
          url: base,
          logo: {
            '@type': 'ImageObject',
            url: base + '/assets/logo.png',
          },
        },
        mainEntityOfPage: url,
      },
      {
        '@type': 'FAQPage',
        '@id': url + '#faq',
        url: url,
        mainEntity: [
          {
            '@type': 'Question',
            name: page.faqQuestion,
            acceptedAnswer: {
              '@type': 'Answer',
              text: page.faqAnswer,
            },
          },
        ],
      },
      buildHelpBreadcrumbs(headline, page.path, base),
    ],
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
      url: base + '/about',
      name: 'About The Networker Hub',
      description:
        'The Networker Hub connects UK business owners and professionals with networking events, exhibitions, and business opportunities.',
      mainEntity: buildOrganizationSchema(base),
    });
  } else if (page === 'rankings') {
    graph.push({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      url: base + '/rankings',
      name: 'Networking group leaderboard – The Networker Hub',
      description:
        'Monthly Top 10, Top 25 and Top 50 networking groups on The Networker Hub, ranked by attendee ratings and review rate.',
      about: buildOrganizationSchema(base),
    });
  } else if (page === 'for-organisers') {
    graph.push({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      url: base + '/for-organisers',
      name: 'For Organisers – The Networker Hub',
      description:
        'Organiser dashboard, guest visit programme, visit tracking, Category Exclusivity, Previous Attendees, and discovery in the UK events and opportunities directories.',
      about: buildOrganizationSchema(base),
    });
  } else if (page === 'for-attendees') {
    graph.push({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      url: base + '/for-attendees',
      name: 'For networkers – The Networker Hub',
      description:
        'UK Events, Organiser pages, and Business Opportunities in one place. Free My Hub account with saved alerts, member rates, booking reminders, reviews, and guest visits.',
      about: buildOrganizationSchema(base),
    });
  } else if (page === 'advertising') {
    graph.push({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      url: base + '/advertising',
      name: 'Advertising & sponsorship – The Networker Hub',
      description:
        'Sponsor placements and advertising rates for the events directory and business opportunities on The Networker Hub.',
      about: buildOrganizationSchema(base),
    });
  } else if (page === 'events') {
    graph.push(
      buildCollectionPageSchema(
        'Networking events',
        '/events/',
        'Browse UK networking events, meetings, webinars, workshops, exhibitions, and awards.',
        base
      )
    );
  } else if (page === 'opportunities') {
    graph.push(
      buildCollectionPageSchema(
        'Business opportunities',
        '/opportunities/',
        'Browse franchises, partnerships, and business opportunities across the UK.',
        base
      )
    );
  } else if (page === 'legal') {
    graph.push({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      url: base + '/legal-policies',
      name: 'Legal & policies — The Networker Hub',
      description:
        'Privacy policy, terms, refunds, and cookie information for The Networker Hub.',
    });
  } else if (page === 'help-organiser-payouts') {
    return buildHelpArticleSchema('organiser-payouts', base);
  } else if (page === 'help-pricing-fees') {
    return buildHelpArticleSchema('pricing-fees', base);
  } else if (page === 'guides') {
    return buildGuidesHubSchema(base);
  } else if (page && page.indexOf('guide-') === 0) {
    return buildGuidePageSchema(page.slice('guide-'.length), base);
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
    '> UK business networking platform — events and business opportunities.\n\n' +
    'Operated by The Networker Group Ltd (Company No. 15252227). Contact: hello@thenetworkerhub.com\n\n' +
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
    '- FAQ: ' +
    base +
    '/faq\n' +
    '- Contact (Hubert assistant): ' +
    base +
    '/contact\n' +
    '- About: ' +
    base +
    '/about\n' +
    '- For Organisers: ' +
    base +
    '/for-organisers\n' +
    '- For Networkers: ' +
    base +
    '/for-attendees\n' +
    '- Organiser guides: ' +
    base +
    '/guides\n' +
    '- Advertising & sponsorship: ' +
    base +
    '/advertising\n' +
    '- Legal: ' +
    base +
    '/legal-policies\n' +
    '- Organiser payouts: ' +
    base +
    '/help/organiser-payouts\n' +
    '- Ticket pricing & fees: ' +
    base +
    '/help/pricing-fees\n' +
    '- Sitemap: ' +
    base +
    '/sitemap.xml\n\n' +
    '## Organiser help articles\n\n' +
    '### When do organisers receive payouts?\n' +
    HELP_PAGES['organiser-payouts'].llmsSummary +
    '\n\nFull page: ' +
    base +
    '/help/organiser-payouts\n\n' +
    '### What fees does The Networker Hub charge on tickets?\n' +
    HELP_PAGES['pricing-fees'].llmsSummary +
    '\n\nFull page: ' +
    base +
    '/help/pricing-fees\n\n' +
    '## Machine discovery\n' +
    '- Sitemap: ' +
    base +
    '/sitemap.xml\n' +
    '- AI crawler policy: ' +
    base +
    '/agents.txt\n' +
    '- Dynamic page meta API: ' +
    base +
    '/api/seo-meta?type=event&slug={slug}\n' +
    '- Organiser meta API: ' +
    base +
    '/api/seo-meta?type=organiser&slug={slug}\n' +
    '- Opportunity meta API: ' +
    base +
    '/api/seo-meta?type=opportunity&slug={slug}\n\n' +
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
  buildCollectionPageSchema,
  buildBreadcrumbListSchema,
  buildHowToSchema,
  buildGuidePageSchema,
  buildGuidesHubSchema,
  buildHelpArticleSchema,
  buildSchemaGraphFromParts,
  buildSchemaGraph,
  buildLlmsTxt,
  FAQ_AEO_ENTRIES,
};
