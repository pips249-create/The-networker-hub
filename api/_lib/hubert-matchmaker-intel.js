/**
 * TINA Matchmaker — query intelligence (synonyms, seniority, UK geo, exclusions).
 * Keeps ranking keyword-fast: curated dictionaries, not embeddings.
 */

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#&\s'-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tier: 1 junior · 2 manager · 3 director · 4 C-level / MD */
const ROLE_SYNONYM_GROUPS = [
  {
    id: 'it_director',
    ladder: 'it',
    tier: 3,
    labels: [
      'it director',
      'director of it',
      'director of information technology',
      'head of it',
      'head of information technology',
      'vp of information technology',
      'vp information technology',
      'vp of it',
      'vp it',
      'cio',
      'chief information officer',
    ],
  },
  {
    id: 'it_manager',
    ladder: 'it',
    tier: 2,
    labels: ['it manager', 'senior it manager', 'information technology manager', 'it lead'],
  },
  {
    id: 'cto',
    ladder: 'tech',
    tier: 4,
    labels: [
      'cto',
      'chief technology officer',
      'chief technical officer',
      'technology director',
      'director of technology',
      'head of technology',
      'head of engineering',
      'vp engineering',
      'vp of engineering',
    ],
  },
  {
    id: 'managing_director',
    ladder: 'exec',
    tier: 4,
    labels: [
      'managing director',
      'md',
      'ceo',
      'chief executive',
      'chief executive officer',
      'executive director',
    ],
  },
  {
    id: 'commercial_director',
    ladder: 'commercial',
    tier: 3,
    labels: [
      'commercial director',
      'vp of sales',
      'vp sales',
      'head of business development',
      'head of sales',
      'sales director',
      'business development director',
    ],
  },
  {
    id: 'marketing_director',
    ladder: 'marketing',
    tier: 3,
    labels: [
      'marketing director',
      'head of marketing',
      'cmo',
      'chief marketing officer',
      'vp marketing',
      'vp of marketing',
      'director of marketing',
    ],
  },
  {
    id: 'marketing_manager',
    ladder: 'marketing',
    tier: 2,
    labels: [
      'marketing manager',
      'senior marketing manager',
      'brand manager',
      'demand gen manager',
      'demand generation manager',
    ],
  },
  {
    id: 'finance_director',
    ladder: 'finance',
    tier: 3,
    labels: [
      'finance director',
      'financial director',
      'cfo',
      'chief financial officer',
      'head of finance',
      'vp finance',
    ],
  },
  {
    id: 'hr_director',
    ladder: 'hr',
    tier: 3,
    labels: [
      'hr director',
      'people director',
      'head of hr',
      'head of people',
      'chief people officer',
      'vp hr',
      'director of people',
    ],
  },
  {
    id: 'operations_director',
    ladder: 'ops',
    tier: 3,
    labels: [
      'operations director',
      'ops director',
      'coo',
      'chief operating officer',
      'head of operations',
      'director of operations',
    ],
  },
];

const PLACE_ALIASES = {
  mcr: 'manchester',
  brum: 'birmingham',
  'greater london': 'london',
  'central london': 'london',
  'north london': 'london',
  'south london': 'london',
  'east london': 'london',
  'west london': 'london',
  'newcastle upon tyne': 'newcastle',
  'stoke on trent': 'stoke-on-trent',
  stoke: 'stoke-on-trent',
};

/** Canonical place → nearby hubs (UK soft-launch coverage). */
const NEARBY_PLACES = {
  chester: ['ellesmere port', 'wrexham', 'warrington', 'liverpool', 'cheshire', 'birkenhead'],
  cheshire: ['chester', 'warrington', 'ellesmere port', 'crewe', 'macclesfield'],
  manchester: ['salford', 'stockport', 'bolton', 'oldham', 'rochdale', 'warrington', 'trafford'],
  liverpool: ['birkenhead', 'wirral', 'warrington', 'chester', 'st helens', 'southport'],
  birmingham: ['solihull', 'wolverhampton', 'coventry', 'dudley', 'walsall'],
  london: ['greater london', 'croydon', 'canary wharf', 'westminster', 'islington'],
  leeds: ['bradford', 'wakefield', 'huddersfield', 'york', 'halifax'],
  bristol: ['bath', 'cardiff', 'newport', 'swindon'],
  glasgow: ['edinburgh', 'paisley', 'stirling'],
  edinburgh: ['glasgow', 'fife', 'livingston'],
  cardiff: ['newport', 'swansea', 'bristol'],
  newcastle: ['sunderland', 'durham', 'gateshead', 'middlesbrough'],
  sheffield: ['rotherham', 'barnsley', 'doncaster', 'leeds'],
  nottingham: ['derby', 'leicester', 'lincoln'],
  warrington: ['chester', 'manchester', 'liverpool', 'wigan'],
  wrexham: ['chester', 'ellesmere port', 'shrewsbury'],
};

const UK_PLACES = Array.from(
  new Set([
    ...Object.keys(PLACE_ALIASES),
    ...Object.values(PLACE_ALIASES),
    ...Object.keys(NEARBY_PLACES),
    ...Object.values(NEARBY_PLACES).flat(),
    'london',
    'manchester',
    'birmingham',
    'leeds',
    'glasgow',
    'liverpool',
    'bristol',
    'sheffield',
    'edinburgh',
    'cardiff',
    'belfast',
    'newcastle',
    'nottingham',
    'leicester',
    'cambridge',
    'oxford',
    'reading',
    'brighton',
    'york',
    'coventry',
    'southampton',
    'portsmouth',
    'plymouth',
    'exeter',
    'norwich',
    'ipswich',
    'milton keynes',
    'reading',
    'slough',
    'croydon',
    'watford',
    'luton',
    'northampton',
    'derby',
    'stoke-on-trent',
    'wolverhampton',
    'hull',
    'preston',
    'blackpool',
    'bolton',
    'stockport',
    'oldham',
    'rochdale',
    'salford',
    'wigan',
    'chester',
    'wrexham',
    'warrington',
    'ellesmere port',
    'birkenhead',
    'wirral',
    'cheshire',
    'crewe',
    'macclesfield',
    'solihull',
    'dudley',
    'walsall',
    'bradford',
    'wakefield',
    'huddersfield',
    'halifax',
    'bath',
    'swansea',
    'newport',
    'swindon',
    'sunderland',
    'durham',
    'middlesbrough',
    'rotherham',
    'barnsley',
    'doncaster',
    'lincoln',
    'worcester',
    'shrewsbury',
    'hereford',
    'gloucester',
    'cheltenham',
  ])
).sort((a, b) => b.length - a.length);

const EXCLUSION_PATTERNS = [
  {
    re: /\b(?:no|not|excluding|exclude|without)\s+(?:any\s+)?(?:agency\s+)?recruiters?\b/i,
    tags: ['recruiter'],
  },
  {
    re: /\b(?:no|not|excluding|exclude|without)\s+(?:any\s+)?(?:recruitment\s+)?agenc(?:y|ies)\b/i,
    tags: ['recruiter', 'agency'],
  },
  {
    re: /\b(?:no|not|excluding|exclude|without)\s+(?:any\s+)?salespeople\b/i,
    tags: ['salesperson'],
  },
];

const EXCLUSION_ROLE_HINTS = {
  recruiter:
    /\b(recruiter|recruitment|talent acquisition|staffing|headhunter|head hunter|resourcing)\b/i,
  agency: /\b(recruitment agency|staffing agency|search firm)\b/i,
  salesperson: /\b(salesperson|sales person|sdr|bdr|cold call)/i,
};

function canonicalPlace(value) {
  const n = normalizeText(value);
  if (!n) return '';
  if (PLACE_ALIASES[n]) return PLACE_ALIASES[n];
  return n;
}

function personRoleHay(person) {
  return normalizeText(
    [person && person.role, person && person.jobTitle, person && person.professionalRole, person && person.blurb]
      .filter(Boolean)
      .join(' ')
  );
}

/**
 * Known UK place(s) mentioned on a profile.
 * Seed/admin locations are often free-text (“Cardiff / South Wales, UK, United Kingdom”) —
 * extract the city so geo scoring does not treat the whole blob as a mismatch.
 */
function personPlaces(person) {
  const raw = [person && person.location, person && person.city, person && person.town, person && person.country]
    .filter(Boolean)
    .join(', ');
  if (!raw) return [];
  const found = extractPlacesFromText(raw);
  if (found.length) return found;
  const c = canonicalPlace(raw);
  // Only keep a single-token / known canonical place — never the whole free-text blob.
  if (c && UK_PLACES.map(canonicalPlace).includes(c)) return [c];
  return [];
}

function personPlace(person) {
  const places = personPlaces(person);
  return places[0] || '';
}

function findRoleGroupsInText(text) {
  const hay = normalizeText(text);
  if (!hay) return [];
  const hits = [];
  const seen = new Set();
  ROLE_SYNONYM_GROUPS.forEach((group) => {
    const matched = group.labels.some((label) => {
      const l = normalizeText(label);
      if (!l) return false;
      if (l.length <= 3) return new RegExp('\\b' + escapeRegExp(l) + '\\b').test(hay);
      return hay.includes(l);
    });
    if (matched && !seen.has(group.id)) {
      seen.add(group.id);
      hits.push(group);
    }
  });
  return hits;
}

function extractPlacesFromText(text) {
  let hay = normalizeText(text);
  if (!hay) return [];
  // Expand aliases in-place for matching multi-word places.
  Object.keys(PLACE_ALIASES)
    .sort((a, b) => b.length - a.length)
    .forEach((alias) => {
      hay = hay.replace(new RegExp('\\b' + escapeRegExp(alias) + '\\b', 'g'), PLACE_ALIASES[alias]);
    });
  const found = [];
  const seen = new Set();
  UK_PLACES.forEach((place) => {
    const p = canonicalPlace(place);
    if (!p || seen.has(p)) return;
    if (new RegExp('\\b' + escapeRegExp(place) + '\\b').test(hay) || hay.includes(p)) {
      // Prefer word-boundary for short names.
      if (place.length <= 4 && !new RegExp('\\b' + escapeRegExp(place) + '\\b').test(hay)) return;
      seen.add(p);
      found.push(p);
    }
  });
  return found;
}

function nearbyFor(place) {
  const p = canonicalPlace(place);
  return (NEARBY_PLACES[p] || []).map(canonicalPlace).filter(Boolean);
}

function wantsWiderSeniority(query) {
  const q = String(query || '');
  return (
    /\bor\s+senior\b/i.test(q) ||
    /\b(?:directors?|heads?)\b[\s\w,]{0,40}\b(?:managers?|leads?)\b/i.test(q) ||
    /\b(?:managers?|leads?)\b[\s\w,]{0,40}\b(?:directors?|heads?)\b/i.test(q) ||
    /\b(?:and|or)\s+(?:senior\s+)?(?:it\s+)?managers?\b/i.test(q)
  );
}

function parseExclusions(query) {
  const tags = new Set();
  EXCLUSION_PATTERNS.forEach((row) => {
    if (row.re.test(String(query || ''))) {
      row.tags.forEach((t) => tags.add(t));
    }
  });
  return Array.from(tags);
}

/**
 * Structured read of the ask — role families (OR), places (OR), exclusions, seniority.
 */
function parseQueryIntel(query) {
  const raw = String(query || '');
  const normalized = normalizeText(raw);
  const roleGroups = findRoleGroupsInText(raw);
  const places = extractPlacesFromText(raw);
  const exclusions = parseExclusions(raw);
  const widenSeniority = wantsWiderSeniority(raw);
  const targetTier = roleGroups.map((g) => g.tier);
  const minTier = targetTier.length ? Math.min(...targetTier) : null;
  return {
    raw,
    normalized,
    roleGroups,
    roleGroupIds: roleGroups.map((g) => g.id),
    ladders: Array.from(new Set(roleGroups.map((g) => g.ladder).filter(Boolean))),
    places,
    exclusions,
    widenSeniority,
    minTier,
    hasRoleIntel: roleGroups.length > 0,
    hasPlaceIntel: places.length > 0,
  };
}

function roleFamilyScore(person, intel) {
  if (!intel || !intel.hasRoleIntel) return 0;
  const personGroups = findRoleGroupsInText(personRoleHay(person));
  if (!personGroups.length) return 0;

  let best = null;
  intel.roleGroups.forEach((want) => {
    personGroups.forEach((got) => {
      let score = null;
      if (want.id === got.id) {
        score = 28;
      } else if (want.ladder && want.ladder === got.ladder) {
        // Same ladder synonym family (IT Director ask ↔ CIO label already same group).
        if (got.tier >= want.tier) {
          score = 22;
        } else if (intel.widenSeniority && got.tier >= want.tier - 1) {
          score = 14;
        } else if (got.tier < want.tier) {
          // Manager when Director asked — keep weak unless widened.
          score = intel.widenSeniority ? 12 : -18;
        }
      }
      if (score != null) best = best == null ? score : Math.max(best, score);
    });
  });
  return best == null ? 0 : best;
}

function geoScore(person, intel) {
  if (!intel || !intel.hasPlaceIntel) return 0;
  const theirsList = personPlaces(person);
  if (theirsList.length) {
    let best = null;
    for (let t = 0; t < theirsList.length; t++) {
      const theirs = theirsList[t];
      if (intel.places.includes(theirs)) best = Math.max(best == null ? -Infinity : best, 36);
      for (let i = 0; i < intel.places.length; i++) {
        const asked = intel.places[i];
        if (nearbyFor(asked).includes(theirs)) best = Math.max(best == null ? -Infinity : best, 16);
      }
    }
    if (best != null && best > 0) return best;
    // Different known place while ask was geo-specific.
    return -12;
  }
  // No structured location — soft credit if the ask’s place appears in blurb/role text
  // (e.g. “based in Pocklington, near York” when location field is empty).
  const hay = personRoleHay(person);
  if (!hay) return 0;
  for (let i = 0; i < intel.places.length; i++) {
    const asked = intel.places[i];
    if (asked && hay.includes(asked)) return 18;
    const near = nearbyFor(asked);
    for (let j = 0; j < near.length; j++) {
      if (hay.includes(near[j])) return 12;
    }
  }
  return 0;
}

function isExcludedPerson(person, intel) {
  if (!intel || !intel.exclusions || !intel.exclusions.length) return false;
  const hay = personRoleHay(person) + ' ' + normalizeText(person && person.company);
  return intel.exclusions.some((tag) => {
    const re = EXCLUSION_ROLE_HINTS[tag];
    return re ? re.test(hay) : false;
  });
}

/**
 * Prefer exact-place matches; backfill nearby when the local pool is thin.
 */
function applyGeoShortlistPreference(rows, intel, maxShortlist) {
  const list = Array.isArray(rows) ? rows.slice() : [];
  if (!intel || !intel.hasPlaceIntel) return list;
  const exact = list.filter((r) => r.geoScore >= 30);
  const nearby = list.filter((r) => r.geoScore >= 12 && r.geoScore < 30);
  const rest = list.filter((r) => r.geoScore < 12);
  const out = [];
  exact.forEach((r) => {
    if (out.length < maxShortlist) out.push(r);
  });
  if (out.length < maxShortlist) {
    nearby.forEach((r) => {
      if (out.length < maxShortlist) out.push(r);
    });
  }
  if (out.length < maxShortlist) {
    rest.forEach((r) => {
      if (out.length < maxShortlist) out.push(r);
    });
  }
  return out;
}

/**
 * When exact place+role shortlist is empty, suggest nearby / synonym alternatives.
 */
function buildSearchSuggestions(candidates, intel, opts) {
  const people = Array.isArray(candidates) ? candidates : [];
  if (!intel || (!intel.hasRoleIntel && !intel.hasPlaceIntel)) return [];
  if (!people.length) return [];

  const suggestions = [];
  const pushUnique = (item) => {
    if (!item || !item.query || !item.count) return;
    if (suggestions.some((s) => s.query === item.query)) return;
    suggestions.push(item);
  };

  const roleLabel =
    intel.roleGroups[0] && intel.roleGroups[0].labels && intel.roleGroups[0].labels[0]
      ? titleCase(intel.roleGroups[0].labels[0])
      : 'matches';

  if (intel.hasPlaceIntel && intel.hasRoleIntel) {
    intel.places.forEach((place) => {
      nearbyFor(place).forEach((near) => {
        const count = people.filter((p) => {
          if (isExcludedPerson(p, intel)) return false;
          if (roleFamilyScore(p, intel) < 12) return false;
          return personPlace(p) === near;
        }).length;
        if (count > 0) {
          pushUnique({
            label: count + '× ' + roleLabel + ' in nearby ' + titleCase(near),
            query: roleLabel + ' in ' + titleCase(near),
            count,
            kind: 'nearby',
          });
        }
      });
    });

    // Same place, synonym / related ladder titles (e.g. CIO when IT Director asked).
    intel.places.forEach((place) => {
      intel.roleGroups.forEach((want) => {
        ROLE_SYNONYM_GROUPS.filter((g) => g.ladder === want.ladder && g.id !== want.id).forEach(
          (alt) => {
            const altIntel = {
              ...intel,
              roleGroups: [alt],
              roleGroupIds: [alt.id],
              hasRoleIntel: true,
              minTier: alt.tier,
            };
            const count = people.filter((p) => {
              if (isExcludedPerson(p, intel)) return false;
              if (personPlace(p) !== place) return false;
              return roleFamilyScore(p, altIntel) >= 20;
            }).length;
            if (count > 0) {
              const altLabel = titleCase(alt.labels[0]);
              pushUnique({
                label: count + '× ' + altLabel + ' in ' + titleCase(place),
                query: altLabel + ' in ' + titleCase(place),
                count,
                kind: 'synonym',
              });
            }
          }
        );
      });
    });
  }

  return suggestions.slice(0, (opts && opts.limit) || 4);
}

function titleCase(value) {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
    .replace(/\bCio\b/g, 'CIO')
    .replace(/\bCto\b/g, 'CTO')
    .replace(/\bCfo\b/g, 'CFO')
    .replace(/\bCmo\b/g, 'CMO')
    .replace(/\bCoo\b/g, 'COO')
    .replace(/\bMd\b/g, 'MD')
    .replace(/\bHr\b/g, 'HR')
    .replace(/\bIt\b/g, 'IT');
}

function emptySuggestionCopy(meta) {
  const suggestions = Array.isArray(meta && meta.suggestions) ? meta.suggestions : [];
  if (!suggestions.length) return null;
  const place =
    meta && meta.queryIntel && meta.queryIntel.places && meta.queryIntel.places[0]
      ? titleCase(meta.queryIntel.places[0])
      : '';
  const role =
    meta && meta.queryIntel && meta.queryIntel.roleGroups && meta.queryIntel.roleGroups[0]
      ? titleCase(meta.queryIntel.roleGroups[0].labels[0])
      : 'that role';
  const bits = suggestions.slice(0, 3).map((s) => s.label);
  return {
    title: place ? 'No exact match in ' + place : 'No exact match yet',
    text:
      'I couldn’t find ' +
      (place ? 'an exact ' + role + ' in ' + place : 'an exact ' + role) +
      ' right now, but I found ' +
      bits.join(', and ') +
      '. Pick one below — or widen the ask.',
    suggestions,
  };
}

module.exports = {
  ROLE_SYNONYM_GROUPS,
  PLACE_ALIASES,
  NEARBY_PLACES,
  UK_PLACES,
  normalizeText,
  canonicalPlace,
  personPlace,
  personPlaces,
  personRoleHay,
  findRoleGroupsInText,
  extractPlacesFromText,
  nearbyFor,
  parseQueryIntel,
  roleFamilyScore,
  geoScore,
  isExcludedPerson,
  applyGeoShortlistPreference,
  buildSearchSuggestions,
  emptySuggestionCopy,
  titleCase,
  wantsWiderSeniority,
};
