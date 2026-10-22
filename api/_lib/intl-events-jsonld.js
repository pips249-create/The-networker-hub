/**
 * Build schema.org ItemList JSON-LD for International link-out events.
 * Pure helper — safe for Node tests and any server inject path.
 */

const EVENTS_PAGE_URL = 'https://www.thenetworkerinternational.com/#events';
const EVENTS_LIST_ID = 'https://www.thenetworkerinternational.com/#events-list';

function padTime(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const match = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return '';
  const hh = String(Number(match[1])).padStart(2, '0');
  const mm = String(Number(match[2])).padStart(2, '0');
  const ss = match[3] != null ? String(Number(match[3])).padStart(2, '0') : '00';
  return hh + ':' + mm + ':' + ss;
}

function toIsoDateTime(date, time) {
  const day = String(date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return '';
  const clock = padTime(time);
  return clock ? day + 'T' + clock : day;
}

function buildEventNode(row) {
  if (!row || !row.title || !row.startsOn || !row.externalUrl) return null;
  const startDate = toIsoDateTime(row.startsOn, row.startsAtLocal);
  if (!startDate) return null;
  const online =
    String(row.countryCode || '')
      .trim()
      .toUpperCase() === 'OL' ||
    String(row.countryName || '')
      .trim()
      .toLowerCase() === 'online';

  const node = {
    '@type': 'Event',
    name: String(row.title),
    startDate: startDate,
    eventAttendanceMode: online
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    url: String(row.externalUrl),
    location: online
      ? {
          '@type': 'VirtualLocation',
          url: String(row.externalUrl),
          name:
            row.city && String(row.city).trim().toLowerCase() !== 'online'
              ? 'Online · ' + String(row.city)
              : 'Online',
        }
      : {
          '@type': 'Place',
          name: String(row.city || row.countryName || 'Venue TBA'),
          address: {
            '@type': 'PostalAddress',
            addressLocality: String(row.city || ''),
            addressCountry: String(row.countryCode || ''),
          },
        },
    offers: {
      '@type': 'Offer',
      url: String(row.externalUrl),
      availability: 'https://schema.org/InStock',
    },
  };

  if (row.endsOn && String(row.endsOn) !== String(row.startsOn)) {
    node.endDate = toIsoDateTime(row.endsOn, null) || String(row.endsOn);
  }
  if (row.description) node.description = String(row.description).slice(0, 500);
  if (row.imageUrl) node.image = [String(row.imageUrl)];
  if (row.organiserName) {
    node.organizer = {
      '@type': 'Organization',
      name: String(row.organiserName),
    };
    if (row.organiserWebsite) node.organizer.url = String(row.organiserWebsite);
  }
  return node;
}

function buildIntlEventsItemList(events, options) {
  options = options || {};
  const list = Array.isArray(events) ? events : [];
  const limit = Math.min(Math.max(Number(options.limit) || 24, 1), 48);
  const items = [];
  for (let i = 0; i < list.length && items.length < limit; i += 1) {
    const eventNode = buildEventNode(list[i]);
    if (!eventNode) continue;
    items.push({
      '@type': 'ListItem',
      position: items.length + 1,
      item: eventNode,
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': EVENTS_LIST_ID,
    name: 'Events around the world',
    description:
      'Upcoming moderated link-out business networking events on The Networker International. Book on the organiser’s site.',
    url: EVENTS_PAGE_URL,
    numberOfItems: items.length,
    itemListElement: items,
  };
}

function serializeIntlEventsJsonLd(events, options) {
  return JSON.stringify(buildIntlEventsItemList(events, options));
}

module.exports = {
  EVENTS_PAGE_URL,
  EVENTS_LIST_ID,
  buildEventNode,
  buildIntlEventsItemList,
  serializeIntlEventsJsonLd,
};
