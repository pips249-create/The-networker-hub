/**
 * Canonical meeting / event types (Supabase events.event_type).
 * Keep in sync with api/_lib/event-types.js
 */
(function (global) {
  var TYPES = [
    { value: 'Networking meeting', label: 'Networking meeting' },
    { value: 'Netwalking', label: 'Netwalking' },
    { value: 'Sport & social', label: 'Sport & social' },
    { value: 'Conference', label: 'Conference' },
    { value: 'Exhibition', label: 'Exhibition' },
    { value: 'Awards ceremony', label: 'Awards ceremony' },
    { value: "Women's networking", label: "Women's networking" },
  ];

  var LEGACY_TYPE_MAP = {
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

  function slugForEventType(type) {
    return String(type || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function normalizeEventType(raw) {
    var t = String(raw || '').trim();
    if (!t) return 'Networking meeting';
    var i;
    for (i = 0; i < TYPES.length; i++) {
      if (TYPES[i].value.toLowerCase() === t.toLowerCase()) return TYPES[i].value;
    }
    var legacy = LEGACY_TYPE_MAP[t.toLowerCase()];
    if (legacy) return legacy;
    if (/netwalk/i.test(t)) return 'Netwalking';
    if (/award/i.test(t)) return 'Awards ceremony';
    if (/exhibit/i.test(t)) return 'Exhibition';
    if (/conference/i.test(t)) return 'Conference';
    if (/women/i.test(t) && /network|only|business/i.test(t)) return "Women's networking";
    if (/golf|padel|tennis|sport|social sport/i.test(t)) return 'Sport & social';
    return 'Networking meeting';
  }

  global.HUB_MEETING_TYPES = TYPES;
  global.hubSlugForEventType = slugForEventType;
  global.hubNormalizeEventType = normalizeEventType;
})(typeof window !== 'undefined' ? window : global);
