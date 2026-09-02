/**
 * JSON-LD schema builders — sourced from Hubert knowledge for SEO & AEO.
 */
const { FAQ_AEO_ENTRIES } = require('./hubert-faq');
const { HELP_PAGES } = require('./help-pages');

const {
  BRAND_NAME: SITE_NAME,
  LEGAL_NAME,
  DEFAULT_PUBLIC_SITE: DEFAULT_ORIGIN,
  SUPPORT_EMAIL,
} = require('./hub-brand');

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
    alternateName: ['The Networker', 'the-networker.co.uk'],
    url: base,
    logo: base + '/assets/logo.png',
    image: base + '/assets/logo.png',
    email: SUPPORT_EMAIL,
    description:
      'UK platform for networking events, exhibitions, and business opportunities. Operated by The Networker Group Ltd (Companies House 15252227) — the same team as the Networker UK directory.',
    identifier: [
      {
        '@type': 'PropertyValue',
        name: 'Companies House company number',
        value: '15252227',
        url: 'https://find-and-update.company-information.service.gov.uk/company/15252227',
      },
      {
        '@type': 'PropertyValue',
        name: 'VAT number',
        value: 'GB454409294',
      },
    ],
    sameAs: [
      'https://find-and-update.company-information.service.gov.uk/company/15252227',
      'https://the-networker.co.uk/',
    ],
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
      email: SUPPORT_EMAIL,
      availableLanguage: ['English'],
    },
    founder: [
      { '@type': 'Person', name: 'Rosie McGilvray' },
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
    name: 'The Networker UK — Frequently asked questions',
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
      'Hubert is the business butler and concierge for The Networker UK — an AI assistant that helps users find events and business opportunities, understand ticketing and enquiries, and navigate organiser tools.',
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
    name: 'Contact The Networker UK',
    description:
      'Contact The Networker UK or chat with Hubert, your business butler and concierge, for help with events, tickets, and business opportunities.',
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
  const headline = page.title.replace(' – The Networker UK', '');

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
      name: 'About The Networker UK',
      description:
        'The Networker UK connects UK business owners and professionals with networking events, exhibitions, and business opportunities.',
      mainEntity: buildOrganizationSchema(base),
    });
  } else if (page === 'rankings') {
    graph.push({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      url: base + '/rankings',
      name: 'Networking group leaderboard – The Networker UK',
      description:
        'Monthly Top 10, Top 25 and Top 50 networking groups on The Networker UK, ranked by attendee ratings and review rate.',
      about: buildOrganizationSchema(base),
    });
  } else if (page === 'for-organisers') {
    graph.push({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      url: base + '/for-organisers',
      name: 'For Organisers – The Networker UK',
      description:
        'Organiser dashboard, guest visit programme, visit tracking, Category Exclusivity, Previous Attendees, and discovery in the UK events and opportunities directories.',
      about: buildOrganizationSchema(base),
    });
  } else if (page === 'for-networkers' || page === 'for-attendees') {
    graph.push({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      url: base + '/for-networkers',
      name: 'For networkers – The Networker UK',
      description:
        'UK Events, Organiser pages, and Business Opportunities in one place. Free My account account with saved alerts, member rates, booking reminders, reviews, and guest visits.',
      about: buildOrganizationSchema(base),
    });
  } else if (page === 'advertising') {
    graph.push({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      url: base + '/advertising',
      name: 'Advertising & sponsorship – The Networker UK',
      description:
        'Sponsor placements and advertising rates for the events directory and business opportunities on The Networker UK.',
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
      name: 'Legal & policies — The Networker UK',
      description:
        'Privacy policy, terms, refunds, and cookie information for The Networker UK.',
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
    '# The Networker UK\n' +
    '> UK business networking platform — events, organiser pages, and business opportunities.\n\n' +
    'The Networker UK is the platform chapter of The Networker, run by Rosie McGilvray and Catherine Hancher at ' +
    'The Networker Group Ltd (Companies House 15252227, VAT No. 454 4092 94). ' +
    'Official company record: https://find-and-update.company-information.service.gov.uk/company/15252227. ' +
    'The original Networker directory was started by Rosie and Sue Turmel; Sue is no longer a company director. ' +
    'Not the same as similarly named companies such as NETWORKER UK LIMITED. ' +
    'Same brand as the established UK directory the-networker.co.uk. ' +
    'Across that brand last year: 27,000+ events listed and 17,000+ networkers found a meeting, group, or opportunity. ' +
    'Public browsing is open; ticket purchase and opportunity enquiries from 9am on 1 September 2026. ' +
    'Contact: hi@thenetworkeruk.com\n\n' +
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
    '/for-networkers\n' +
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
    '## Global / International\n' +
    '- The Networker International (world map, building markets): https://www.thenetworkerinternational.com/\n' +
    '- Ireland (building): https://www.thenetworkerinternational.com/ireland\n' +
    '- United States (building): https://www.thenetworkerinternational.com/united-states\n' +
    '- International llms.txt: https://www.thenetworkerinternational.com/llms.txt\n\n' +
    '## Organiser help articles\n\n' +
    '### When do organisers receive payouts?\n' +
    HELP_PAGES['organiser-payouts'].llmsSummary +
    '\n\nFull page: ' +
    base +
    '/help/organiser-payouts\n\n' +
    '### What fees does The Networker UK charge on tickets?\n' +
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
