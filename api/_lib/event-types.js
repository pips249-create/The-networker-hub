/** Canonical meeting types — keep in sync with js/meeting-types.js */
const MEETING_TYPES = [
  'Networking meeting',
  'Netwalking',
  'Sport & social',
  'Conference',
  'Exhibition',
  'Awards ceremony',
  "Women's networking",
];

const LEGACY_TYPE_MAP = {
  'networking event': 'Networking meeting',
  'networking / meeting': 'Networking meeting',
  exhibition: 'Exhibition',
  conference: 'Conference',
  webinar: 'Conference',
  workshop: 'Networking meeting',
  'sport & social': 'Sport & social',
  'sport and social': 'Sport & social',
  'sports & social': 'Sport & social',
  'sport networking': 'Sport & social',
  "women's networking": "Women's networking",
  'women only': "Women's networking",
  'women-only': "Women's networking",
};

function normalizeEventType(raw) {
  const t = String(raw || '').trim();
  if (!t) return 'Networking meeting';
  const exact = MEETING_TYPES.find((m) => m.toLowerCase() === t.toLowerCase());
  if (exact) return exact;
  const legacy = LEGACY_TYPE_MAP[t.toLowerCase()];
  if (legacy) return legacy;
  if (/netwalk/i.test(t)) return 'Netwalking';
  if (/award/i.test(t)) return 'Awards ceremony';
  if (/exhibit/i.test(t)) return 'Exhibition';
  if (/conference/i.test(t)) return 'Conference';
  if (/women/i.test(t) && /network|only|business/i.test(t)) return "Women's networking";
  if (/golf|padel|tennis|sport|social sport/i.test(t)) return 'Sport & social';
  return 'Networking meeting';
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
  if (t === 'Netwalking') return 'netwalking';
  if (t === 'Awards ceremony') return 'awards';
  if (t === 'Sport & social') return 'sport-social';
  if (t === "Women's networking") return 'womens-networking';
  return 'meeting';
}

module.exports = {
  MEETING_TYPES,
  normalizeEventType,
  slugForEventType,
  parseTypeCategory,
};
