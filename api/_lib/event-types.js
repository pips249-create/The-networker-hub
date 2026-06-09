/** Canonical meeting types — keep in sync with js/meeting-types.js */
const MEETING_TYPES = ['Meeting', 'Events', 'Exhibition', 'Awards'];

const LEGACY_TYPE_MAP = {
  'networking meeting': 'Meeting',
  'networking event': 'Meeting',
  'networking / meeting': 'Meeting',
  netwalking: 'Meeting',
  workshop: 'Meeting',
  "women's networking": 'Meeting',
  'women only': 'Meeting',
  'women-only': 'Meeting',
  conference: 'Events',
  webinar: 'Events',
  'sport & social': 'Events',
  'sport and social': 'Events',
  'sports & social': 'Events',
  'sport networking': 'Events',
  exhibition: 'Exhibition',
  'awards ceremony': 'Awards',
  awards: 'Awards',
};

function normalizeEventType(raw) {
  const t = String(raw || '').trim();
  if (!t) return 'Meeting';
  const exact = MEETING_TYPES.find((m) => m.toLowerCase() === t.toLowerCase());
  if (exact) return exact;
  const legacy = LEGACY_TYPE_MAP[t.toLowerCase()];
  if (legacy) return legacy;
  if (/award/i.test(t)) return 'Awards';
  if (/exhibit/i.test(t)) return 'Exhibition';
  if (/conference|summit|festival/i.test(t)) return 'Events';
  if (/netwalk|golf|padel|tennis|sport|social sport/i.test(t)) return 'Meeting';
  if (/women/i.test(t) && /network|only|business/i.test(t)) return 'Meeting';
  if (/meeting|networking|breakfast|lunch/i.test(t)) return 'Meeting';
  return 'Meeting';
}

function slugForEventType(type) {
  return String(type || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseTypeCategory(raw) {
  const t = normalizeEventType(raw);
  if (t === 'Exhibition') return 'exhibition';
  if (t === 'Events') return 'events';
  if (t === 'Awards') return 'awards';
  return 'meeting';
}

module.exports = {
  MEETING_TYPES,
  normalizeEventType,
  slugForEventType,
  parseTypeCategory,
};
