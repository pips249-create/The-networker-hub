/**
 * Build schema.org ItemList JSON-LD for International link-out events.
 * Pure helper — safe for Node tests and any server inject path.
 *
 * Keeps Google Event rich-result recommended fields populated even when a
 * listing has no ticket price row (link-out bookings live on the organiser site).
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

function currencyForCountry(code) {
  const c = String(code || '')
    .trim()
    .toUpperCase();
  if (c === 'GB' || c === 'UK') return 'GBP';
  if (c === 'CA') return 'CAD';
  if (c === 'AU') return 'AUD';
  if (c === 'NZ') return 'NZD';
  if (
    c === 'IE' ||
    c === 'DE' ||
    c === 'FR' ||
    c === 'ES' ||
    c === 'IT' ||
    c === 'NL' ||
    c === 'BE' ||
    c === 'AT' ||
    c === 'PT' ||
    c === 'FI' ||
    c === 'EE' ||
    c === 'LV' ||
    c === 'LT' ||
    c === 'SK' ||
    c === 'SI' ||
    c === 'LU' ||
    c === 'MT' ||
    c === 'CY'
  ) {
    return 'EUR';
  }
  return 'USD';
}

function eventDescription(row) {
  const explicit = String((row && row.description) || '')
    .trim()
    .slice(0, 500);
  if (explicit) return explicit;
  const place = [row && row.city, row && row.countryName]
    .map(function (part) {
      return String(part || '').trim();
    })
    .filter(Boolean)
    .join(', ');
  const who = String((row && row.organiserName) || '').trim();
  let text = 'Business networking event';
  if (place) text += ' in ' + place;
  if (who) text += ' hosted by ' + who;
  text += '. Book on the organiser’s site.';
  return text.slice(0, 500);
}

function eventEndDate(row, startDate) {
  const endsOn = String((row && row.endsOn) || '').trim();
  const startsOn = String((row && row.startsOn) || '').trim();
  if (endsOn) {
    const endClock = padTime((row && row.endsAtLocal) || '');
    if (endClock) {
      return toIsoDateTime(endsOn, row.endsAtLocal);
    }
    // Same-day listings often only store ends_on = starts_on with no end clock.
    if (endsOn === startsOn && String(startDate || '').indexOf('T') !== -1) {
      return startDate;
    }
    return toIsoDateTime(endsOn, null) || endsOn;
  }
  // Google flags missing endDate — fall back to start when the feed has no end.
  return startDate;
}

function offerValidFrom(row, startDate) {
  const created = String((row && row.createdAt) || '').trim();
  if (created) {
    const ms = Date.parse(created);
    if (!Number.isNaN(ms)) return new Date(ms).toISOString();
  }
  return startDate;
}

function offerPrice(row) {
  if (row && row.priceNum != null && Number.isFinite(Number(row.priceNum))) {
    return Number(row.priceNum);
  }
  if (row && row.price != null && Number.isFinite(Number(row.price))) {
    return Number(row.price);
  }
  // Link-out rows do not store ticket fees — publish 0 so GSC has the field;
  // booking URL remains the source of truth on the organiser site.
  return 0;
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
  const externalUrl = String(row.externalUrl);

  const node = {
    '@type': 'Event',
    name: String(row.title),
    description: eventDescription(row),
    startDate: startDate,
    endDate: eventEndDate(row, startDate),
    eventAttendanceMode: online
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    url: externalUrl,
    location: online
      ? {
          '@type': 'VirtualLocation',
          url: externalUrl,
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
      url: externalUrl,
      availability: 'https://schema.org/InStock',
      price: offerPrice(row),
      priceCurrency: currencyForCountry(row.countryCode),
      validFrom: offerValidFrom(row, startDate),
    },
  };

  if (row.imageUrl) node.image = [String(row.imageUrl)];
  if (row.organiserName) {
    const orgName = String(row.organiserName);
    node.organizer = {
      '@type': 'Organization',
      name: orgName,
    };
    node.performer = {
      '@type': 'PerformingGroup',
      name: orgName,
    };
    if (row.organiserWebsite) {
      node.organizer.url = String(row.organiserWebsite);
      node.performer.url = String(row.organiserWebsite);
    }
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
  currencyForCountry,
  eventDescription,
  eventEndDate,
  offerValidFrom,
  buildEventNode,
  buildIntlEventsItemList,
  serializeIntlEventsJsonLd,
};
