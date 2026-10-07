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

function countPhrase(listingCount, dateCount) {
  const listings = Number(listingCount) || 0;
  const dates = Number(dateCount) || 0;
  if (listings <= 0) return '';
  const listingWord = listings === 1 ? 'listing' : 'listings';
  if (dates > listings) {
    return (
      listings +
      ' ' +
      listingWord +
      ', covering ' +
      dates +
      ' upcoming ' +
      (dates === 1 ? 'date' : 'dates')
    );
  }
  return listings + ' upcoming ' + listingWord;
}

function buildNetworkingRegionAnswer(region, eventCount, tagline, dateCount) {
  const place = placePhrase(region);
  const themeLine = String(tagline || '').trim();
  const counted = countPhrase(eventCount, dateCount);

  if (region.slug === 'online') {
    return (
      'Find online business networking events, webinars and virtual meetings on The Networker UK. ' +
      (counted
        ? 'Browse ' + counted + '. Join from anywhere in the UK. '
        : 'Browse upcoming listings you can join from anywhere in the UK. ') +
      'Workshops, hybrid sessions and virtual meetings are included. Filter by date and price, then book a ticket when you are ready.'
    );
  }

  const lead = counted
    ? 'Find business networking ' + place + ' — browse ' + counted + ' on The Networker UK.'
    : 'Find business networking ' + place + ' — browse upcoming listings on The Networker UK.';

  const middle = themeLine
    ? ' ' +
      themeLine +
      ' Listings include breakfast meetings, evening mixers, workshops, conferences and industry groups.'
    : ' Listings include breakfast meetings, evening mixers, workshops, conferences and local networking communities.';

  return (
    lead +
    middle +
    ' Filter by date, format and price, then open an event to book, or visit an organiser page for their next meetings.'
  );
}

function buildNetworkingRegionFaqs(region, eventCount, tagline, dateCount) {
  const name = region.name;
  const place = placePhrase(region);
  const path = region.path || '/networking/' + region.slug;
  const count = Number(eventCount) || 0;
  const dates = Number(dateCount) || 0;
  const isOnline = region.slug === 'online';
  const local = String(tagline || '').trim().replace(/\.\s*$/, '');
  const fromLine = /^from\b/i.test(local)
    ? local.charAt(0).toLowerCase() + local.slice(1)
    : '';
  const counted = countPhrase(count, dates);
  const seriesNote =
    dates > count && count > 0
      ? ' Each listing is one group. When that group meets on several dates, those dates stay on the same listing.'
      : '';
  const countLine = counted
    ? ' There are currently ' + counted + '.' + seriesNote
    : ' New meetings are added as organisers publish them.';

  const whereQ = isOnline
    ? 'Where can I find online networking events?'
    : 'Where can I find networking events ' + place + '?';
  const whereA = isOnline
    ? 'Online networking events are listed on The Networker UK at ' +
      path +
      '.' +
      countLine +
      ' Each listing shows whether it is a webinar, virtual meeting or workshop, plus the date and ticket price. Filter by date, open an event to book, or visit an organiser page to see that group’s next sessions.'
    : 'Networking events ' +
      place +
      ' are listed on The Networker UK at ' +
      path +
      '.' +
      countLine +
      (fromLine ? ' Coverage runs ' + fromLine + '.' : local ? ' ' + local + '.' : '') +
      ' Open an event to see the date, format and price, then book a ticket, or open an organiser page to see that group’s next meetings.';

  const freeQ = isOnline
    ? 'Are there free online networking events?'
    : 'Are there free networking events ' + place + '?';
  const freeA = isOnline
    ? 'Yes. Free online networking is listed alongside paid webinars and virtual meetings. Many organisers also offer a guest visit so you can try a group before you join. Use the price filter on this page to show free and low-cost sessions, then open a listing to confirm a guest ticket is available.'
    : 'Yes. Free networking ' +
      place +
      ' is listed on this page alongside paid breakfasts, mixers and workshops. Many groups offer a guest visit so you can try a meeting before you join. Filter by price to show free and low-cost events, then open a listing or the organiser’s page to confirm a guest ticket.';

  const listQ = isOnline
    ? 'How do I list an online networking event on The Networker UK?'
    : 'How do I list my networking group ' + place + '?';
  const listA = isOnline
    ? 'List an online networking event by claiming a free organiser page, then publishing the meeting from the organiser dashboard. Once it is live it can appear in the online directory with the date, format and ticket price, so people can find it and book. You do not need a paid listing to get started. Begin at /for-organisers.'
    : 'List a networking group ' +
      place +
      ' by claiming a free organiser page, then publishing your meetings from the organiser dashboard. Once a meeting is live it can appear in the ' +
      name +
      ' directory, with the date, format and ticket price, so people can find it and book. You do not need a paid listing to get started. Begin at /for-organisers.';

  const typesQ = isOnline
    ? 'What types of online networking are listed?'
    : 'What types of networking happen ' + place + '?';
  const typesA = isOnline
    ? 'Online networking on The Networker UK covers webinars, virtual meetings, workshops and hybrid events you can join from anywhere in the UK. Listings show the date, format and price. Filter this page by date and price to see what is coming up, then book a ticket from the event page.'
    : 'Networking ' +
      place +
      ' includes breakfast meetings, evening mixers, workshops, conferences, exhibitions and industry groups' +
      (fromLine ? ', ' + fromLine : '') +
      '. Hybrid and online meetings you can join from ' +
      name +
      ' are listed too. Filter this page by format, date and price to see what is on, then book from the event page.';

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
    .map(function (item, index) {
      return (
        '<details class="networking-region-faq-item" name="networking-region-faq"' +
        (index === 0 ? ' open' : '') +
        '>' +
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
    '<div class="networking-region-faq-accent" aria-hidden="true"></div>' +
    '<div class="networking-region-faq-inner">' +
    '<p class="networking-region-kicker">Common questions</p>' +
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

function buildNetworkingRegionSeoCopy(region, eventCount, dateCount) {
  const theme = getRegionTheme(region.slug) || {};
  const tagline = theme.tagline || '';
  const answerText = buildNetworkingRegionAnswer(region, eventCount, tagline, dateCount);
  const faqs = buildNetworkingRegionFaqs(region, eventCount, tagline, dateCount);
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
  countPhrase,
};
