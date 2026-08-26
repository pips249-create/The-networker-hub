/**
 * Detect competitor ticketing / RSVP platforms in listing text.
 * Used for admin alerts — does not block publish.
 */

const PLATFORMS = [
  {
    id: 'eventbrite',
    label: 'Eventbrite',
    pattern: /\beventbrite(?:\.com)?\b/i,
  },
  {
    id: 'ticket_tailor',
    label: 'Ticket Tailor',
    pattern: /\bticket\s*tailor\b|\btickettailor\.com\b/i,
  },
  {
    id: 'luma',
    label: 'Luma',
    pattern: /\blu\.ma\b|\bluma\.com\b/i,
  },
  {
    id: 'meetup',
    label: 'Meetup',
    // Prefer domain — plain "meetup" is common UK networking copy.
    pattern: /\bmeetup\.com\b/i,
  },
  {
    id: 'net_hub',
    label: 'Net Hub',
    // Prefer domain — "net hub" alone is too vague / brand-adjacent.
    pattern: /\bmynethub\.com\b|\bmy\s*net\s*hub\b/i,
  },
  {
    id: 'partiful',
    label: 'Partiful',
    pattern: /\bpartiful(?:\.com)?\b/i,
  },
  {
    id: 'humanitix',
    label: 'Humanitix',
    pattern: /\bhumanitix(?:\.com)?\b/i,
  },
  {
    id: 'dice',
    label: 'Dice',
    pattern: /\bdice\.fm\b/i,
  },
  {
    id: 'skiddle',
    label: 'Skiddle',
    pattern: /\bskiddle(?:\.com)?\b/i,
  },
  {
    id: 'ticketsource',
    label: 'TicketSource',
    pattern: /\bticketsource(?:\.co\.uk|\.com)?\b/i,
  },
];

function findOffPlatformBookingMentions(text) {
  const haystack = String(text || '');
  if (!haystack.trim()) return [];
  const hits = [];
  for (const platform of PLATFORMS) {
    if (platform.pattern.test(haystack)) {
      hits.push({ id: platform.id, label: platform.label });
    }
  }
  return hits;
}

function scanEventForOffPlatformBooking(row) {
  const text = [
    row?.title,
    row?.description,
    row?.meeting_link,
    row?.location_label,
    row?.venue,
  ]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join('\n');
  return findOffPlatformBookingMentions(text);
}

module.exports = {
  PLATFORMS,
  findOffPlatformBookingMentions,
  scanEventForOffPlatformBooking,
};
