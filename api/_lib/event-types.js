/** Canonical meeting types — keep in sync with js/meeting-types.js */
const MEETING_TYPES = [
  'Meeting',
  'Conference',
  'Events',
  'Exhibition',
  'Awards',
  'Webinar',
  'Workshop',
  'Session',
];

const LEGACY_TYPE_MAP = {
  'networking meeting': 'Meeting',
  'networking event': 'Meeting',
  'networking / meeting': 'Meeting',
  netwalking: 'Meeting',
  workshop: 'Workshop',
  "women's networking": 'Meeting',
  'women only': 'Meeting',
  'women-only': 'Meeting',
  conference: 'Conference',
  webinar: 'Webinar',
  session: 'Session',
  'sport & social': 'Meeting',
  'sport and social': 'Meeting',
  'sports & social': 'Meeting',
  'sport networking': 'Meeting',
  exhibition: 'Exhibition',
  'awards ceremony': 'Meeting',
  awards: 'Meeting',
};

function normalizeEventType(raw) {
  const t = String(raw || '').trim();
  if (!t) return 'Meeting';
  const exact = MEETING_TYPES.find((m) => m.toLowerCase() === t.toLowerCase());
  if (exact) return exact;
  const legacy = LEGACY_TYPE_MAP[t.toLowerCase()];
  if (legacy) return legacy;
  if (/exhibit/i.test(t)) return 'Exhibition';
  if (/webinar/i.test(t)) return 'Webinar';
  if (/workshop/i.test(t)) return 'Workshop';
  if (/\bsession\b/i.test(t)) return 'Session';
  if (/conference|summit/i.test(t)) return 'Conference';
  if (/festival|award|netwalk|golf|padel|tennis|sport|social sport/i.test(t)) {
    return 'Meeting';
  }
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
  if (t === 'Conference') return 'conference';
  if (t === 'Events') return 'events';
  if (t === 'Awards') return 'awards';
  if (t === 'Webinar') return 'webinar';
  if (t === 'Workshop') return 'workshop';
  if (t === 'Session') return 'session';
  return 'meeting';
}

module.exports = {
  MEETING_TYPES,
  normalizeEventType,
  slugForEventType,
  parseTypeCategory,
};
