/**
 * Canonical meeting / event types (Supabase events.event_type).
 * Keep in sync with api/_lib/event-types.js
 */
(function (global) {
  var TYPES = [
    { value: 'Meeting', label: 'Meeting' },
    { value: 'Conference', label: 'Conference' },
    { value: 'Events', label: 'Events' },
    { value: 'Exhibition', label: 'Exhibition' },
    { value: 'Awards', label: 'Awards' },
    { value: 'Webinar', label: 'Webinar' },
    { value: 'Workshop', label: 'Workshop' },
    { value: 'Session', label: 'Session' },
  ];

  var LEGACY_TYPE_MAP = {
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

  function slugForEventType(type) {
    return String(type || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function normalizeEventType(raw) {
    var t = String(raw || '').trim();
    if (!t) return 'Meeting';
    var i;
    for (i = 0; i < TYPES.length; i++) {
      if (TYPES[i].value.toLowerCase() === t.toLowerCase()) return TYPES[i].value;
    }
    var legacy = LEGACY_TYPE_MAP[t.toLowerCase()];
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

  global.HUB_MEETING_TYPES = TYPES;
  global.hubSlugForEventType = slugForEventType;
  global.hubNormalizeEventType = normalizeEventType;
})(typeof window !== 'undefined' ? window : global);
