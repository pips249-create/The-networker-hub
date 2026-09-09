/**
 * Answer blocks + FAQs for /networking/:slug city & county hubs (SEO + AEO).
 */
const { getRegionTheme } = require('./networking-region-themes');

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function placePhrase(region) {
  const name = region && region.name ? String(region.name) : 'your area';
  if (region && region.slug === 'online') return 'online';
  return 'in ' + name;
}

function buildNetworkingRegionAnswer(region, eventCount, tagline) {
  const name = region.name;
  const place = placePhrase(region);
  const themeLine = String(tagline || '').trim();
  const count = Number(eventCount) || 0;

  if (region.slug === 'online') {
    return (
      'Find online business networking events, webinars and virtual meetings on The Networker UK. ' +
      (themeLine ? themeLine + ' ' : '') +
      (count > 0
        ? 'Browse ' + count + ' upcoming online listings and book when you are ready.'
        : 'Browse upcoming listings and book when you are ready.')
    );
  }

  const lead =
    count > 0
      ? 'Find business networking ' +
        place +
        ' — browse ' +
        count +
        ' upcoming events, meetings and organiser groups on The Networker UK.'
      : 'Find business networking ' +
        place +
        ' — browse upcoming events, meetings and organiser groups on The Networker UK.';

  const middle = themeLine
    ? ' ' + themeLine
    : ' Discover breakfast meetings, workshops, conferences and local networking communities.';

  return lead + middle + ' Filter by date, format and price, then book tickets when you are ready.';
}

function buildNetworkingRegionFaqs(region, eventCount) {
  const name = region.name;
  const place = placePhrase(region);
  const path = region.path || '/networking/' + region.slug;
  const count = Number(eventCount) || 0;
  const isOnline = region.slug === 'online';

  const whereQ = isOnline
    ? 'Where can I find online networking events?'
    : 'Where can I find networking events ' + place + '?';
  const whereA = isOnline
    ? 'Browse upcoming webinars and virtual networking meetings on The Networker UK at ' +
      path +
      '. Filter by date and book tickets when you are ready.'
    : 'Browse upcoming business networking events and groups ' +
      place +
      ' on The Networker UK at ' +
      path +
      '.' +
      (count > 0 ? ' There are currently ' + count + ' upcoming listings.' : '') +
      ' Open an event to book, or visit an organiser page to see their next meetings.';

  const freeQ = isOnline
    ? 'Are there free online networking events?'
    : 'Are there free networking events ' + place + '?';
  const freeA =
    'Many organisers list free events or guest-visit options. Use the filters on this page to spot free and low-cost meetings, or open an organiser profile to see guest visits before you book.';

  const listQ = isOnline
    ? 'How do I list an online networking event on The Networker UK?'
    : 'How do I list my networking group ' + place + '?';
  const listA =
    'Claim a free organiser page, then publish your meetings from the organiser dashboard. Your events can appear on this ' +
    (isOnline ? 'online' : name) +
    ' directory so networkers can find and book them. Start at /for-organisers.';

  const typesQ = isOnline
    ? 'What types of online networking are listed?'
    : 'What types of networking happen ' + place + '?';
  const typesA = isOnline
    ? 'Webinars, virtual meetings, workshops and hybrid events you can join from anywhere in the UK.'
    : 'Breakfast meetings, evening mixers, workshops, conferences, exhibitions and industry groups — plus online options you can join from ' +
      name +
      '.';

  return [
    { question: whereQ, answer: whereA },
    { question: freeQ, answer: freeA },
    { question: listQ, answer: listA },
    { question: typesQ, answer: typesA },
  ];
}

function buildNetworkingRegionFaqSchema(faqs, canonical) {
  if (!faqs || !faqs.length) return null;
  return {
    '@type': 'FAQPage',
    '@id': canonical + '#faq',
    mainEntity: faqs.map(function (item) {
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

function buildNetworkingRegionFaqHtml(faqs, region) {
  if (!faqs || !faqs.length) return '';
  const name = escapeHtml(region.name);
  const heading =
    region.slug === 'online'
      ? 'Online networking — FAQ'
      : 'Networking in ' + name + ' — FAQ';

  const items = faqs
    .map(function (item) {
      return (
        '<details class="networking-region-faq-item">' +
        '<summary class="networking-region-faq-q">' +
        escapeHtml(item.question) +
        '</summary>' +
        '<p class="networking-region-faq-a">' +
        escapeHtml(item.answer) +
        '</p>' +
        '</details>'
      );
    })
    .join('');

  return (
    '<section class="networking-region-faq" id="networking-region-faq" data-hub-ssr-faq="1" aria-labelledby="networking-region-faq-heading">' +
    '<div class="networking-region-faq-inner">' +
    '<h2 id="networking-region-faq-heading">' +
    heading +
    '</h2>' +
    '<div class="networking-region-faq-list" id="networking-region-faq-list">' +
    items +
    '</div>' +
    '</div>' +
    '</section>'
  );
}

function buildNetworkingRegionSeoCopy(region, eventCount) {
  const theme = getRegionTheme(region.slug) || {};
  const tagline = theme.tagline || '';
  const answerText = buildNetworkingRegionAnswer(region, eventCount, tagline);
  const faqs = buildNetworkingRegionFaqs(region, eventCount);
  return {
    tagline: tagline,
    answerText: answerText,
    faqs: faqs,
    faqHtml: buildNetworkingRegionFaqHtml(faqs, region),
  };
}

module.exports = {
  buildNetworkingRegionAnswer,
  buildNetworkingRegionFaqs,
  buildNetworkingRegionFaqSchema,
  buildNetworkingRegionFaqHtml,
  buildNetworkingRegionSeoCopy,
};
