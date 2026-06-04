/** Canonical meeting types — keep in sync with js/meeting-types.js */
const MEETING_TYPES = [
  'Networking meeting',
  'Netwalking',
  'Conference',
  'Exhibition',
  'Awards ceremony',
];

const LEGACY_TYPE_MAP = {
  'networking event': 'Networking meeting',
  'networking / meeting': 'Networking meeting',
  exhibition: 'Exhibition',
  conference: 'Conference',
  webinar: 'Conference',
  workshop: 'Networking meeting',
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
  return 'meeting';
}

module.exports = {
  MEETING_TYPES,
  normalizeEventType,
  slugForEventType,
  parseTypeCategory,
};
