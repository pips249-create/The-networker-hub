/**
 * Hubert Matchmaker — back-of-house shortlist (max 5).
 * Never returns email, phone, or LinkedIn.
 *
 * Pool: discoverable members + private seed + Hub attendees of events
 * matched from the query (so “who attended Evolution…” works against
 * existing bookings, still privacy-safe).
 *
 * Ranking is intentionally keyword + light intent (no LLM round-trip yet):
 * fast, but must not admit people solely for having any upcoming event.
 */
const MAX_SHORTLIST = 5;
/** Rotate the shortlist across this many top-scoring candidates. */
const SHORTLIST_ROTATION_POOL = 12;
const MIN_QUERY_LEN = 3;
/** Meaningful text hits required unless this is an event-attendee lookup. */
const MIN_TEXT_SCORE = 6;
/** Short privacy-safe teaser on shortlist cards (not the full Hubert blurb). */
const SHORTLIST_BLURB_MAX = 110;

const EVENT_QUERY_HINT =
  /\b(attended|attendee|attendees|attending|who went|who was at|who'?s going|going to|this morning|this afternoon|yesterday|last night|today)\b/i;

const EMPLOYEE_QUERY_HINT =
  /\b(employees?|staff|hires?|hiring|recruit(?:ing|ment)?|job[\s-]?seekers?|candidates?|talent|workers?)\b/i;
const FOUNDER_QUERY_HINT =
  /\b(founders?|ceos?|owners?|entrepreneurs?|co[\s-]?founders?|managing directors?|mds?\b)\b/i;
const INVESTOR_QUERY_HINT = /\b(investors?|angels?|vcs?|venture|funds?)\b/i;
const CLIENT_QUERY_HINT =
  /\b(clients?|customers?|buyers?|prospects?|advertisers?|sponsors?)\b/i;

const FOUNDER_ROLE_HINT =
  /\b(founder|co[\s-]?founder|ceo|owner|entrepreneur|managing director|\bmd\b)\b/i;
const EMPLOYEE_ROLE_HINT =
  /\b(employee|manager|director|lead|head of|specialist|executive|officer|associate|consultant|marketer|sales)\b/i;

/** Filler words that match almost everyone (esp. “UK” on this platform). */
const QUERY_STOP = new Set([
  'am',
  'looking',
  'for',
  'the',
  'and',
  'with',
  'this',
  'that',
  'from',
  'someone',
  'people',
  'person',
  'who',
  'want',
  'meet',
  'like',
  'around',
  'might',
  'be',
  'interested',
  'in',
  'on',
  'or',
  'my',
  'me',
  'i',
  'a',
  'an',
  'of',
  'to',
  'at',
  'is',
  'are',
  'was',
  'were',
  'any',
  'some',
  'please',
  'find',
  'show',
  'list',
  'need',
  'needs',
  'would',
  'could',
  'can',
  'get',
  'have',
  'has',
  'had',
  'also',
  'just',
  'really',
  'very',
  'into',
  'about',
  'across',
  'within',
  'uk',
  'united',
  'kingdom',
  'britain',
  'british',
  'networker',
  'hubert',
  'introduce',
  'introduction',
  'intro',
  'connect',
  'connection',
]);

const EVENT_STOP = new Set([
  'who',
  'want',
  'meet',
  'like',
  'looking',
  'for',
  'the',
  'and',
  'with',
  'this',
  'that',
  'from',
  'someone',
  'people',
  'person',
  'attended',
  'attendee',
  'attendees',
  'attending',
  'went',
  'was',
  'were',
  'are',
  'is',
  'at',
  'to',
  'a',
  'an',
  'of',
  'in',
  'on',
  'or',
  'my',
  'me',
  'i',
  'morning',
  'afternoon',
  'evening',
  'yesterday',
  'today',
  'tonight',
  'last',
  'next',
  'week',
  'month',
  'event',
  'events',
  'please',
  'find',
  'show',
  'list',
  'any',
  'some',
  // Generic event words — match almost every Hub listing if left in.
  'virtual',
  'online',
  'hybrid',
  'zoom',
  'networking',
  'network',
  'meetup',
  'meeting',
  'meetings',
  'club',
  'multi',
  'business',
  'women',
  'men',
  'community',
  'session',
  'sessions',
  'group',
  'groups',
  'lunch',
  'breakfast',
  'dinner',
  'drinks',
  'mixer',
  'forum',
  'summit',
  'conference',
  'workshop',
  'webinar',
  'panel',
  'roundtable',
  'mastermind',
  // Date noise — used for proximity, not title scoring.
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
  'january',
  'february',
  'march',
  'april',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
  'jan',
  'feb',
  'mar',
  'apr',
  'jun',
  'jul',
  'aug',
  'sep',
  'sept',
  'oct',
  'nov',
  'dec',
]);

const MONTH_INDEX = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

function shortDisplayName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'Member';
  if (parts.length === 1) return parts[0];
  return parts[0] + ' ' + parts[parts.length - 1].charAt(0).toUpperCase() + '.';
}

/**
 * Common misspellings → canonical tokens (applied before tokenize).
 * Keep this list small and high-confidence — not a full spellchecker.
 */
const QUERY_TYPO_FIXES = [
  [/\bdirecters\b/gi, 'directors'],
  [/\bdirecter\b/gi, 'director'],
  [/\bmanaggers\b/gi, 'managers'],
  [/\bmanagger\b/gi, 'manager'],
  [/\bmanagment\b/gi, 'management'],
  [/\badvertizing\b/gi, 'advertising'],
  [/\badvertizement\b/gi, 'advertisement'],
  [/\bfinteck?\b/gi, 'fintech'],
  [/\bsollicitors\b/gi, 'solicitors'],
  [/\bsollicitor\b/gi, 'solicitor'],
  [/\baccountents\b/gi, 'accountants'],
  [/\benterpreneurs?\b/gi, 'entrepreneurs'],
  [/\bentrepeneurs?\b/gi, 'entrepreneurs'],
];

/** Two-letter role tokens that are meaningful (normally length-filtered). */
const SHORT_KEEP_TOKENS = new Set(['md', 'hr', 'pr', 'vc']);

/** Extra match forms for short acronyms / aliases. */
const TOKEN_ALIASES = {
  md: ['managing director', 'director', 'md'],
  hr: ['human resources', 'human resource', 'hr'],
  pr: ['public relations', 'pr'],
  vc: ['venture capital', 'venture capitalist', 'investor', 'vc'],
};

function normalizeSearchQuery(query) {
  let q = String(query || '');
  QUERY_TYPO_FIXES.forEach(([re, to]) => {
    q = q.replace(re, to);
  });
  return q;
}

function tokenize(query) {
  return normalizeSearchQuery(query)
    .toLowerCase()
    .replace(/[^a-z0-9+#&\s-]/gi, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t && !QUERY_STOP.has(t) && (t.length >= 3 || SHORT_KEEP_TOKENS.has(t)))
    .slice(0, 24);
}

/**
 * Light singular/plural (+ typo/acronym aliases) so asks match job titles.
 * Keeps the original token; does not invent aggressive stems.
 */
function expandTokenForms(token) {
  const t = String(token || '')
    .trim()
    .toLowerCase();
  const forms = new Set();
  if (!t) return [];
  forms.add(t);

  const aliases = TOKEN_ALIASES[t];
  if (aliases) aliases.forEach((a) => forms.add(a));

  if (t.length < 4) return Array.from(forms);

  if (t.endsWith('ies') && t.length >= 5) {
    forms.add(t.slice(0, -3) + 'y'); // companies → company
  } else if (
    t.endsWith('sses') ||
    t.endsWith('xes') ||
    t.endsWith('zes') ||
    t.endsWith('ches') ||
    t.endsWith('shes')
  ) {
    forms.add(t.slice(0, -2)); // businesses → business (via sses handled above for ss)
  } else if (t.endsWith('s') && !t.endsWith('ss') && !t.endsWith('us') && !t.endsWith('is')) {
    forms.add(t.slice(0, -1)); // directors → director
  }

  // Singular query → plural haystack (“director” vs “Directors network”)
  if (!t.endsWith('s')) {
    if (t.endsWith('y') && t.length >= 4 && !/[aeiou]y$/.test(t)) {
      forms.add(t.slice(0, -1) + 'ies');
    } else {
      forms.add(t + 's');
    }
  }

  return Array.from(forms);
}

function isDateNoiseToken(t) {
  const s = String(t || '');
  if (/^\d{4}$/.test(s)) return true; // year
  if (/^\d{1,2}(st|nd|rd|th)?$/.test(s)) return true; // 29 / 29th
  return false;
}

function eventSearchTokens(query) {
  return String(query || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#&\s-]/gi, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(
      (t) =>
        t.length >= 3 &&
        !EVENT_STOP.has(t) &&
        !QUERY_STOP.has(t) &&
        !isDateNoiseToken(t)
    )
    .slice(0, 24);
}

/**
 * Best-effort date from the ask (e.g. “Thursday 29th October 2026”).
 * Used to prefer the right session when several titles share a brand.
 */
function extractQueryEventDate(query) {
  const text = String(query || '').toLowerCase();
  const yearMatch = text.match(/\b(20\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : null;
  let month = null;
  Object.keys(MONTH_INDEX).forEach((name) => {
    if (new RegExp('\\b' + name + '\\b', 'i').test(text)) {
      month = MONTH_INDEX[name];
    }
  });
  const dayMatch = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
  let day = null;
  if (dayMatch) {
    const n = Number(dayMatch[1]);
    // Ignore bare years already captured; ignore tiny/noise numbers.
    if (n >= 1 && n <= 31 && !(yearMatch && dayMatch[1] === yearMatch[1])) {
      day = n;
    }
  }
  if (year == null || month == null || day == null) return null;
  const dt = new Date(Date.UTC(year, month, day, 12, 0, 0));
  if (Number.isNaN(dt.getTime())) return null;
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month || dt.getUTCDate() !== day) {
    return null;
  }
  return dt;
}

function looksLikeEventAttendeeQuery(query) {
  return EVENT_QUERY_HINT.test(String(query || ''));
}

/**
 * Light intent from the ask — not an LLM; enough to stop “employees” → founders.
 */
function extractQueryIntent(query) {
  const text = String(query || '');
  const wantEmployees = EMPLOYEE_QUERY_HINT.test(text);
  const wantFounders = FOUNDER_QUERY_HINT.test(text);
  const wantInvestors = INVESTOR_QUERY_HINT.test(text);
  const wantClients = CLIENT_QUERY_HINT.test(text);
  return {
    wantEmployees,
    wantFounders,
    wantInvestors,
    wantClients,
    /** Prefer role fit over weak keyword overlap. */
    roleSensitive: wantEmployees || wantFounders || wantInvestors || wantClients,
  };
}

function personRoleText(person) {
  return [person.role, person.jobTitle, person.professionalRole, person.blurb]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function roleFitScore(person, intent) {
  if (!intent || !intent.roleSensitive) return 0;
  const role = personRoleText(person);
  if (!role) return 0;
  const isFounder = FOUNDER_ROLE_HINT.test(role);
  const isEmployeeLike = EMPLOYEE_ROLE_HINT.test(role) && !isFounder;

  if (intent.wantEmployees) {
    if (isEmployeeLike) return 18;
    if (isFounder) return -30;
    return -8;
  }
  if (intent.wantFounders) {
    if (isFounder) return 18;
    if (isEmployeeLike) return -10;
    return 0;
  }
  if (intent.wantInvestors) {
    if (/\b(investor|angel|venture|vc)\b/i.test(role)) return 18;
    return 0;
  }
  if (intent.wantClients) {
    if (/\b(buyer|client|customer|procurement|marketing|advertis)/i.test(role)) return 12;
    return 0;
  }
  return 0;
}

function haystackFor(person) {
  return [
    person.fullName,
    person.company,
    person.jobTitle,
    person.industry,
    person.professionalRole,
    person.blurb,
    person.matchedEvent && person.matchedEvent.title,
    ...(Array.isArray(person.lookingToMeet) ? person.lookingToMeet : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function scoreAgainstQuery(person, tokens) {
  if (!tokens.length) return 0;
  const hay = haystackFor(person);
  if (!hay) return 0;
  let score = 0;
  tokens.forEach((t) => {
    // Longer tokens (advertising, employees) weigh more than short leftovers.
    // Two-letter role acronyms (MD/HR) expand to real titles — keep them above the floor.
    const weight = SHORT_KEEP_TOKENS.has(t) ? 4 : t.length >= 8 ? 5 : t.length >= 5 ? 4 : 3;
    const forms = expandTokenForms(t);
    let hit = false;
    let boundary = false;
    forms.forEach((f) => {
      if (hay.includes(f)) hit = true;
      if (
        new RegExp('(?:^|\\s)' + f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(hay)
      ) {
        boundary = true;
      }
    });
    // Score once per original token even when plural/singular both match.
    if (hit) score += weight;
    if (boundary) score += 2;
  });
  return score;
}

/**
 * Event boost tiers (spec): same event > other upcoming > none.
 * Used as a tie-breaker among relevant people — not an admission ticket.
 */
function eventBoost(person, requesterEventIds) {
  const ids = Array.isArray(requesterEventIds) ? requesterEventIds : [];
  const theirs = person.nextEvent && person.nextEvent.eventId ? String(person.nextEvent.eventId) : '';
  if (theirs && ids.includes(theirs)) return 40;
  if (person.nextEvent && person.nextEvent.title) return 12;
  return 0;
}

function matchedEventBoost(person) {
  return person && person.matchedEvent && person.matchedEvent.eventId ? 55 : 0;
}

/** Stable 32-bit hash for weekly shortlist rotation. */
function hashSeed(raw) {
  let h = 2166136261;
  const s = String(raw || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function weekBucket(nowMs) {
  const ms = Number.isFinite(nowMs) ? Number(nowMs) : Date.now();
  return Math.floor(ms / (7 * 24 * 60 * 60 * 1000));
}

/**
 * Slide a window of MAX_SHORTLIST across the top SHORTLIST_ROTATION_POOL
 * so the same ask does not always surface the same five people.
 * Quality order inside the pool is preserved; only the window moves.
 */
function rotateShortlistWindow(rankedRows, opts) {
  const rows = Array.isArray(rankedRows) ? rankedRows : [];
  if (rows.length <= MAX_SHORTLIST) return rows;
  const poolSize = Math.min(rows.length, SHORTLIST_ROTATION_POOL);
  const pool = rows.slice(0, poolSize);
  if (opts && opts.disableRotation) {
    return pool.slice(0, MAX_SHORTLIST);
  }
  const maxOffset = Math.max(0, pool.length - MAX_SHORTLIST);
  if (maxOffset === 0) return pool.slice(0, MAX_SHORTLIST);
  const seed = hashSeed(
    [
      (opts && opts.rotationKey) || '',
      weekBucket(opts && opts.nowMs),
      String((opts && opts.query) || '')
        .trim()
        .toLowerCase(),
    ].join('|')
  );
  const offset = seed % (maxOffset + 1);
  return pool.slice(offset, offset + MAX_SHORTLIST);
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Role words that can also appear as surnames — do not strip from blurbs. */
const NAME_STRIP_ROLE_BLOCK =
  /^(director|manager|founder|partner|officer|consultant|executive|president|secretary|owner|chair|lead)$/i;

/**
 * Strip name + company from shortlist copy so a card cannot be LinkedIn’d.
 * Avoids nuking common verbs (will/mark) by only stripping full name, company,
 * a leading first-name opener, and distinctive surnames.
 */
function stripIdentifyingPhrases(text, person) {
  let out = String(text || '');
  const full = String((person && person.fullName) || '').trim();
  const parts = full.split(/\s+/).filter(Boolean);
  const company = String((person && person.company) || '').trim();

  if (full) {
    out = out.replace(new RegExp('\\b' + escapeRegExp(full) + '\\b', 'gi'), ' ');
  }
  if (company.length >= 3) {
    out = out.replace(new RegExp('\\b' + escapeRegExp(company) + '\\b', 'gi'), ' ');
  }
  // Hub brand in a blurb + first-name initial is enough to identify Rosie/Catherine.
  out = out.replace(/\bthe\s+networker(?:\s+(?:uk|group(?:\s+ltd)?))?\b/gi, ' ');

  const first = parts[0] || '';
  if (first.length >= 3) {
    out = out.replace(new RegExp('^' + escapeRegExp(first) + '\\b[,\\s:—–-]*', 'i'), '');
  }

  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  if (last.length >= 5 && !NAME_STRIP_ROLE_BLOCK.test(last)) {
    out = out.replace(new RegExp('\\b' + escapeRegExp(last) + '\\b', 'gi'), ' ');
  }

  return out
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.;:\-–—/]+/, '')
    .replace(/^(?:(?:runs?|is|was|works?|working|helps?|helping)\b[\s,]*)+/i, '')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
}

function softTruncateBlurb(text, maxLen) {
  const max = Number.isFinite(maxLen) ? maxLen : SHORTLIST_BLURB_MAX;
  const s = String(text || '').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const at = Math.max(
    cut.lastIndexOf('. '),
    cut.lastIndexOf('; '),
    cut.lastIndexOf(', '),
    cut.lastIndexOf(' ')
  );
  const base = (at >= Math.floor(max * 0.55) ? cut.slice(0, at) : cut)
    .trim()
    .replace(/[,:;.\-–—]+$/, '');
  return base + '…';
}

/**
 * Shortlist-safe blurb — short, no name/company (LinkedIn cut-out guard).
 */
function shortlistBlurb(person) {
  const raw = String((person && person.blurb) || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (raw) {
    const cleaned = stripIdentifyingPhrases(raw, person);
    // After stripping name/company/brand, drop tiny leftovers (“Building”).
    if (cleaned && cleaned.length >= 12) {
      return softTruncateBlurb(cleaned, SHORTLIST_BLURB_MAX);
    }
  }
  const looking = Array.isArray(person && person.lookingToMeet)
    ? person.lookingToMeet.map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  if (looking.length) return 'Looking to meet ' + looking.slice(0, 3).join(', ');
  return '';
}

/**
 * Public shortlist card — privacy-safe.
 * Never include company (LinkedIn cut-out risk with first name + company),
 * email, phone, or LinkedIn. Role / industry + Hubert blurb only.
 */
function toPublicShortlistCard(row) {
  return {
    id: row.person.id,
    kind: row.person.kind,
    displayName: row.person.displayName,
    role: row.person.role || '',
    industry: row.person.industry || '',
    blurb: shortlistBlurb(row.person),
    // Intentionally omitted from the client payload — used only for BOH ranking.
    company: '',
    why: buildWhy(row) || row.person.why || '',
    nextEvent: row.person.nextEvent
      ? {
          title: row.person.nextEvent.title,
          dateLabel: row.person.nextEvent.dateLabel || '',
          eventId: row.person.nextEvent.eventId || '',
        }
      : row.person.matchedEvent
        ? {
            title: row.person.matchedEvent.title,
            dateLabel: row.person.matchedEvent.dateLabel || '',
            eventId: row.person.matchedEvent.eventId || '',
          }
        : null,
    onHub: Boolean(row.person.onHub),
    score: row.total,
  };
}

function rankCandidates(candidates, query, requesterEventIds, opts) {
  const tokens = tokenize(query);
  const intent = extractQueryIntent(query);

  const ranked = (candidates || [])
    .map((person) => {
      const textScore = scoreAgainstQuery(person, tokens);
      const roleScore = roleFitScore(person, intent);
      const boost = eventBoost(person, requesterEventIds);
      const matchedBoost = matchedEventBoost(person);
      const brandScore = platformBrandMatchScore(person, query);
      const total = textScore + roleScore + boost + matchedBoost + brandScore;
      return {
        person,
        textScore,
        roleScore,
        boost,
        matchedBoost,
        brandScore,
        total,
        intent,
      };
    })
    .filter((row) => {
      // “Who attended X?” — booking match is enough.
      if (row.matchedBoost > 0) return true;
      // “The Networker UK directors” → Rosie / Catherine / Hub team.
      if (row.brandScore >= 18) return true;
      // Otherwise require real topical overlap. Upcoming events alone are not a match.
      if (row.textScore < MIN_TEXT_SCORE) return false;
      // Hard role clash (e.g. founders for an employees ask) drop out.
      if (row.roleScore <= -20) return false;
      return true;
    })
    .sort(
      (a, b) =>
        b.total - a.total ||
        b.brandScore - a.brandScore ||
        b.textScore - a.textScore ||
        b.roleScore - a.roleScore ||
        b.matchedBoost - a.matchedBoost ||
        b.boost - a.boost ||
        String(a.person.displayName).localeCompare(String(b.person.displayName))
    );

  return rotateShortlistWindow(ranked, {
    rotationKey: opts && opts.rotationKey,
    nowMs: opts && opts.nowMs,
    query,
  }).map(toPublicShortlistCard);
}

function buildWhy(row) {
  if (row.matchedBoost > 0) {
    const title = row.person.matchedEvent && row.person.matchedEvent.title;
    return title ? 'Booked for ' + title : 'Booked for a matching event';
  }
  if (row.brandScore >= 18) return 'Part of The Networker UK team';
  if (row.roleScore >= 12 && row.intent && row.intent.wantEmployees) {
    return 'Role fits who you asked to meet';
  }
  if (row.roleScore >= 12 && row.intent && row.intent.wantFounders) {
    return 'Founder / owner — matches your ask';
  }
  if (row.boost >= 40 && row.textScore >= MIN_TEXT_SCORE) {
    return 'You’ll both be at the same upcoming event';
  }
  if (row.textScore >= MIN_TEXT_SCORE) return 'Matches what you asked Hubert for';
  if (row.boost >= 12) return 'Has an upcoming event on The Networker UK';
  return '';
}

function formatDateLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Platform ops (Catherine / Rosie / Jamie / Networker Group).
 * Kept out of general intro supply so they do not dominate every ask —
 * but they SHOULD surface when someone asks for The Networker UK team/directors.
 */
const INTERNAL_NAME_HINT =
  /\b(rosie\s+mcgilvray|catherine\s+hancher|jamie\s+hancher)\b/i;
const INTERNAL_COMPANY_HINT =
  /\b(the\s+networker\s+group|networker\s+group\s+ltd|the\s+networker\s+uk)\b/i;

function isInternalMatchCandidate(person) {
  if (!person) return false;
  const name = String(person.fullName || person.displayName || '').trim();
  const company = String(person.company || '').trim();
  if (INTERNAL_NAME_HINT.test(name)) return true;
  if (INTERNAL_COMPANY_HINT.test(company)) return true;
  return false;
}

/** True when the ask is about The Networker UK / Group itself. */
function queryMentionsNetworkerBrand(query) {
  return /\b(?:the\s+)?networker(?:\s+(?:uk|group))?\b/i.test(String(query || ''));
}

/**
 * Boost Hub team into results for Networker UK brand asks
 * (e.g. “The networker UK directors” → Rosie & Catherine).
 */
function platformBrandMatchScore(person, query) {
  if (!queryMentionsNetworkerBrand(query) || !isInternalMatchCandidate(person)) return 0;
  let score = 18;
  const q = String(query || '').toLowerCase();
  if (
    /\bdirectors?\b/.test(q) ||
    /\b(founders?|owners?|ceos?|team|ops|organisers?|organizers?)\b/.test(q)
  ) {
    score += 12;
  }
  return score;
}

function mapSeedRow(row) {
  return {
    id: 'seed:' + row.id,
    kind: 'seed',
    fullName: row.full_name,
    displayName: shortDisplayName(row.full_name),
    role: row.professional_role || row.job_title || '',
    company: row.company || '',
    jobTitle: row.job_title || '',
    industry: row.industry || '',
    professionalRole: row.professional_role || '',
    lookingToMeet: Array.isArray(row.looking_to_meet) ? row.looking_to_meet : [],
    blurb: row.blurb || '',
    nextEvent: null,
    matchedEvent: null,
    onHub: false,
    why: 'Hubert can invite them to join',
  };
}

function mapMemberRow(row, nextEvent, matchedEvent) {
  const discoverable = Boolean(row.discoverable_at);
  return {
    id: 'member:' + row.id,
    kind: 'member',
    fullName: row.name,
    displayName: shortDisplayName(row.name),
    role: row.professional_role || row.job_title || '',
    company: row.company || '',
    jobTitle: row.job_title || '',
    industry: row.business_sector || '',
    professionalRole: row.professional_role || '',
    lookingToMeet: Array.isArray(row.looking_to_meet) ? row.looking_to_meet : [],
    blurb: row.matchmaker_blurb || '',
    nextEvent: nextEvent || null,
    matchedEvent: matchedEvent || null,
    onHub: true,
    why: matchedEvent
      ? 'Booked for ' + (matchedEvent.title || 'this event')
      : discoverable
        ? 'Member'
        : 'Member',
  };
}

function scoreEventTitle(title, tokens) {
  const hay = String(title || '').toLowerCase();
  const toks = Array.isArray(tokens) ? tokens : [];
  if (!hay || !toks.length) return 0;
  let score = 0;
  let misses = 0;
  toks.forEach((t) => {
    if (hay.includes(t)) score += t.length >= 6 ? 3 : 2;
    else misses += 1;
  });
  // Distinctive brand tokens (evolution, barnsgate, …) must all appear.
  // Prevents “virtual networking” from latching onto any virtual mixer.
  if (misses > 0) return 0;
  return score;
}

function eventDateProximityBoost(startsAt, queryDate) {
  if (!queryDate || !startsAt) return 0;
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return 0;
  const diffMs = Math.abs(start.getTime() - queryDate.getTime());
  const dayMs = 24 * 60 * 60 * 1000;
  if (diffMs <= dayMs) return 40;
  if (diffMs <= 3 * dayMs) return 20;
  if (diffMs <= 7 * dayMs) return 8;
  return 0;
}

function isUsableEventStatus(status) {
  const s = String(status || '')
    .trim()
    .toLowerCase();
  // Past Hub nights are often archived; still useful for “who attended…”.
  return s !== 'cancelled' && s !== 'draft' && s !== 'rejected';
}

function toEventMatchCard(row) {
  const ev = row.event || row;
  return {
    id: String(ev.id),
    title: ev.title || 'Event',
    startsAt: ev.starts_at || ev.startsAt || null,
    dateLabel: formatDateLabel(ev.starts_at || ev.startsAt),
    score: Number(row.score) || 0,
    titleScore: Number(row.titleScore) || 0,
  };
}

/**
 * Only auto-load attendees when the title match is unambiguous.
 * Otherwise return candidates for a “Which event?” confirm step —
 * stopwords alone will never keep silent wrong picks from recurring.
 */
function resolveEventMatchSelection(scoredRows, opts) {
  const rows = Array.isArray(scoredRows) ? scoredRows.map(toEventMatchCard) : [];
  const minGap = opts && Number.isFinite(opts.minGap) ? Number(opts.minGap) : 15;
  if (!rows.length) {
    return { matchedEvents: [], eventCandidates: [], needsEventPick: false, confident: false };
  }
  if (rows.length === 1) {
    return {
      matchedEvents: [rows[0]],
      eventCandidates: rows,
      needsEventPick: false,
      confident: true,
    };
  }
  const top = rows[0];
  const second = rows[1];
  const clearWinner =
    top.score >= second.score + minGap ||
    (top.titleScore > second.titleScore && top.score > second.score);
  if (clearWinner) {
    return {
      matchedEvents: [top],
      eventCandidates: rows.slice(0, 5),
      needsEventPick: false,
      confident: true,
    };
  }
  return {
    matchedEvents: [],
    eventCandidates: rows.slice(0, 5),
    needsEventPick: true,
    confident: false,
  };
}

async function loadEventById(sb, eventId) {
  const id = String(eventId || '').trim();
  if (!id) return null;
  try {
    const { data, error } = await sb
      .from('events')
      .select('id, title, starts_at, status')
      .eq('id', id)
      .maybeSingle();
    if (error || !data || !isUsableEventStatus(data.status)) return null;
    return {
      id: String(data.id),
      title: data.title || 'Event',
      startsAt: data.starts_at,
      dateLabel: formatDateLabel(data.starts_at),
      score: 100,
      titleScore: 100,
    };
  } catch {
    return null;
  }
}

async function findMatchingEvents(sb, query) {
  const tokens = eventSearchTokens(query);
  if (!tokens.length) return [];

  const queryDate = extractQueryEventDate(query);
  const fromIso = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
  const toIso = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString();

  let rows = [];
  try {
    const { data, error } = await sb
      .from('events')
      .select('id, title, starts_at, status')
      .gte('starts_at', fromIso)
      .lte('starts_at', toIso)
      .order('starts_at', { ascending: false })
      .limit(400);
    if (error) return [];
    rows = (data || []).filter((ev) => isUsableEventStatus(ev.status));
  } catch {
    return [];
  }

  const scored = rows
    .map((ev) => {
      const titleScore = scoreEventTitle(ev.title, tokens);
      const dateBoost = eventDateProximityBoost(ev.starts_at, queryDate);
      return {
        event: ev,
        titleScore,
        score: titleScore + dateBoost,
      };
    })
    .filter((row) => row.titleScore > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.titleScore - a.titleScore ||
        String(b.event.starts_at).localeCompare(String(a.event.starts_at))
    );

  // At least one distinctive brand token must hit the title.
  const minScore = tokens.some((t) => t.length >= 6) ? 3 : 2;
  return scored.filter((row) => row.titleScore >= minScore).slice(0, 8);
}

function isActiveRegistration(row) {
  if (!row) return false;
  if (row.cancelled_at) return false;
  const app = String(row.application_status || 'Approved').trim();
  if (app && app !== 'Approved') return false;
  const pay = String(row.payment_status || '').trim();
  if (pay === 'Refunded') return false;
  return true;
}

async function loadAttendeesForEvents(sb, events, excludeAttendeeId) {
  const out = [];
  const eventList = Array.isArray(events) ? events : [];
  if (!eventList.length) return out;

  const eventIds = eventList.map((e) => e.id).filter(Boolean);
  const byId = new Map(eventList.map((e) => [e.id, e]));

  const richSelect =
    'attendee_id, event_id, cancelled_at, application_status, payment_status, attendees!inner(id, name, company, job_title, business_sector, professional_role, looking_to_meet, matchmaker_blurb, discoverable_at)';
  const basicSelect =
    'attendee_id, event_id, cancelled_at, application_status, payment_status, attendees!inner(id, name, company, job_title, business_sector)';

  let data = null;
  let error = null;
  try {
    const rich = await sb.from('registrations').select(richSelect).in('event_id', eventIds).is('cancelled_at', null).limit(400);
    data = rich.data;
    error = rich.error;
  } catch (e) {
    error = e;
  }
  if (error) {
    try {
      const basic = await sb
        .from('registrations')
        .select(basicSelect)
        .in('event_id', eventIds)
        .is('cancelled_at', null)
        .limit(400);
      data = basic.data;
      error = basic.error;
    } catch {
      return out;
    }
  }
  if (error) return out;

  const seen = new Set();
  (data || []).forEach((row) => {
    if (!isActiveRegistration(row)) return;
    const att = row.attendees;
    if (!att || !att.id || !att.name) return;
    if (excludeAttendeeId && String(att.id) === String(excludeAttendeeId)) return;
    const key = String(att.id);
    if (seen.has(key)) return;
    seen.add(key);
    const ev = byId.get(String(row.event_id)) || null;
    const matchedEvent = ev
      ? { eventId: ev.id, title: ev.title, dateLabel: ev.dateLabel || formatDateLabel(ev.startsAt) }
      : null;
    out.push(mapMemberRow(att, null, matchedEvent));
  });
  return out;
}

async function loadRequesterUpcomingEventIds(sb, attendeeId) {
  if (!attendeeId) return [];
  const nowIso = new Date().toISOString();
  const { data, error } = await sb
    .from('registrations')
    .select('event_id, events!inner(id, starts_at)')
    .eq('attendee_id', attendeeId)
    .is('cancelled_at', null)
    .gte('events.starts_at', nowIso)
    .limit(30);
  if (error) return [];
  return (data || [])
    .map((r) => String(r.event_id || (r.events && r.events.id) || '').trim())
    .filter(Boolean);
}

async function loadNextEventsByAttendeeIds(sb, attendeeIds) {
  const map = new Map();
  const ids = (attendeeIds || []).filter(Boolean);
  if (!ids.length) return map;
  const nowIso = new Date().toISOString();
  const { data, error } = await sb
    .from('registrations')
    .select('attendee_id, event_id, events!inner(id, title, starts_at)')
    .in('attendee_id', ids)
    .is('cancelled_at', null)
    .gte('events.starts_at', nowIso)
    .order('starts_at', { ascending: true, foreignTable: 'events' })
    .limit(500);
  if (error) return map;
  (data || []).forEach((row) => {
    const aid = row.attendee_id;
    if (!aid || map.has(aid)) return;
    const ev = row.events || {};
    map.set(aid, {
      eventId: String(row.event_id || ev.id || ''),
      title: ev.title || 'Upcoming event',
      dateLabel: formatDateLabel(ev.starts_at),
    });
  });
  return map;
}

async function searchMatchmaker(opts) {
  const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'supabase_not_configured', matches: [] };
  }
  const query = String(opts.query || '').trim();
  if (query.length < MIN_QUERY_LEN) {
    return {
      ok: false,
      error: 'query_too_short',
      message: 'Tell Hubert a bit more about who you want to meet.',
      matches: [],
    };
  }

  const sb = getSupabaseAdmin();
  const excludeAttendeeId = opts.excludeAttendeeId || null;
  const requesterEventIds = await loadRequesterUpcomingEventIds(sb, excludeAttendeeId);

  let requesterDiscoverable = false;
  if (excludeAttendeeId) {
    try {
      const { data: selfRow } = await sb
        .from('attendees')
        .select('discoverable_at')
        .eq('id', excludeAttendeeId)
        .maybeSingle();
      requesterDiscoverable = Boolean(selfRow && selfRow.discoverable_at);
    } catch {
      requesterDiscoverable = false;
    }
  }

  const candidates = [];
  const byId = new Map();
  const allowInternal = queryMentionsNetworkerBrand(query);

  function addCandidate(person) {
    if (!person || !person.id) return;
    // Hub team stays out of general supply; allowed for Networker UK brand asks.
    if (isInternalMatchCandidate(person) && !allowInternal) return;
    const existing = byId.get(person.id);
    if (!existing) {
      byId.set(person.id, person);
      candidates.push(person);
      return;
    }
    // Prefer richer row (matched event / discoverable blurb).
    if (!existing.matchedEvent && person.matchedEvent) existing.matchedEvent = person.matchedEvent;
    if (!existing.nextEvent && person.nextEvent) existing.nextEvent = person.nextEvent;
    if (!existing.blurb && person.blurb) existing.blurb = person.blurb;
  }

  // Active seed contacts
  try {
    const seedRes = await sb
      .from('hubert_match_seed')
      .select(
        'id, full_name, company, job_title, industry, professional_role, looking_to_meet, blurb, status'
      )
      .eq('status', 'active')
      .limit(200);
    if (!seedRes.error) {
      (seedRes.data || []).forEach((row) => addCandidate(mapSeedRow(row)));
    }
  } catch {
    /* seed table may be missing pre-migration */
  }

  // Discoverable members
  try {
    let memberQuery = sb
      .from('attendees')
      .select(
        'id, name, company, job_title, business_sector, professional_role, looking_to_meet, matchmaker_blurb, discoverable_at'
      )
      .not('discoverable_at', 'is', null)
      .limit(200);
    if (excludeAttendeeId) memberQuery = memberQuery.neq('id', excludeAttendeeId);
    const memberRes = await memberQuery;
    if (!memberRes.error) {
      const rows = memberRes.data || [];
      const nextMap = await loadNextEventsByAttendeeIds(
        sb,
        rows.map((r) => r.id)
      );
      rows.forEach((row) => {
        if (!row.name) return;
        addCandidate(mapMemberRow(row, nextMap.get(row.id) || null, null));
      });
    }
  } catch {
    /* discoverable columns may be missing pre-migration */
  }

  // Networker UK brand asks: include Hub team even if they have not opted into Include me.
  if (allowInternal) {
    try {
      let opsQuery = sb
        .from('attendees')
        .select(
          'id, name, company, job_title, business_sector, professional_role, looking_to_meet, matchmaker_blurb, discoverable_at'
        )
        .or(
          [
            'name.ilike.%McGilvray%',
            'name.ilike.%Hancher%',
            'company.ilike.%Networker Group%',
            'company.ilike.%Networker UK%',
          ].join(',')
        )
        .limit(30);
      if (excludeAttendeeId) opsQuery = opsQuery.neq('id', excludeAttendeeId);
      const opsRes = await opsQuery;
      if (!opsRes.error) {
        const rows = opsRes.data || [];
        const nextMap = await loadNextEventsByAttendeeIds(
          sb,
          rows.map((r) => r.id)
        );
        rows.forEach((row) => {
          if (!row.name) return;
          const person = mapMemberRow(row, nextMap.get(row.id) || null, null);
          if (!isInternalMatchCandidate(person)) return;
          addCandidate(person);
        });
      }
    } catch {
      /* attendees query may fail on older schemas */
    }
  }

  // Existing Hub bookings: only for attendee-intent asks (“who attended Evolution…”)
  let matchedEvents = [];
  let eventCandidates = [];
  let needsEventPick = false;
  let eventAttendeeCount = 0;
  const lockedEventId = String(opts.eventId || opts.event_id || '').trim();
  const eventQuery = Boolean(lockedEventId) || looksLikeEventAttendeeQuery(query);

  if (lockedEventId) {
    const locked = await loadEventById(sb, lockedEventId);
    if (locked) {
      matchedEvents = [locked];
      eventCandidates = [locked];
    }
  } else if (eventQuery) {
    const scored = await findMatchingEvents(sb, query);
    const selection = resolveEventMatchSelection(scored);
    matchedEvents = selection.matchedEvents;
    eventCandidates = selection.eventCandidates;
    needsEventPick = selection.needsEventPick;
  }

  if (matchedEvents.length && !needsEventPick) {
    const eventPeople = await loadAttendeesForEvents(sb, matchedEvents, excludeAttendeeId);
    eventAttendeeCount = eventPeople.length;
    eventPeople.forEach(addCandidate);
  }

  const matches = needsEventPick
    ? []
    : rankCandidates(candidates, query, requesterEventIds, {
        rotationKey: excludeAttendeeId || '',
        query,
      });
  const meta = {
    max: MAX_SHORTLIST,
    rotationPool: SHORTLIST_ROTATION_POOL,
    candidateCount: needsEventPick ? 0 : candidates.length,
    requesterUpcomingEvents: requesterEventIds.length,
    matchedEvents: matchedEvents.map((e) => ({
      id: e.id,
      title: e.title,
      dateLabel: e.dateLabel,
    })),
    eventCandidates: eventCandidates.map((e) => ({
      id: e.id,
      title: e.title,
      dateLabel: e.dateLabel,
    })),
    eventAttendeeCount,
    eventQuery,
    needsEventPick,
    lockedEventId: lockedEventId || null,
    requesterDiscoverable,
  };
  meta.empty = emptyStateCopy(meta);
  return {
    ok: true,
    query,
    matches,
    meta,
  };
}

/**
 * Empty-state copy for the Meet people UI (shared with client tests).
 */
function emptyStateCopy(meta) {
  const m = meta || {};
  if (m.eventQuery) {
    if (m.needsEventPick) {
      return {
        title: 'Which event did you mean?',
        text: 'A few listings look possible — pick the right one and I’ll introduce people from that room only.',
      };
    }
    const titles = Array.isArray(m.matchedEvents) ? m.matchedEvents.map((e) => e && e.title).filter(Boolean) : [];
    if (titles.length && Number(m.eventAttendeeCount || 0) === 0) {
      return {
        title: 'No bookings I can introduce yet',
        text:
          'I matched “' +
          titles[0] +
          '” on The Networker UK, but nobody’s booked that I can show. Try another session, or ask who you need by role.',
      };
    }
    if (!titles.length) {
      return {
        title: 'I couldn’t match that event',
        text: 'Try the event name as it appears on The Networker UK — or describe who you need (role, city, problem).',
      };
    }
  }
  if (Number(m.candidateCount || 0) === 0) {
    if (m.requesterDiscoverable) {
      return {
        title: 'Nobody else is in the pool yet',
        text:
          'You’re included — Hubert never shows you your own profile. Add people in Admin → Hubert Matchmaker (seed list), or have another member tick Include me, then try again.',
      };
    }
    return {
      title: 'No one came back yet',
      text: 'The member pool is still thin for that ask. Try another description, or check back after more people opt in.',
    };
  }
  return {
    title: 'No close matches yet',
    text:
      'Hubert only puts people forward when the ask fits. Try a clearer role or industry (e.g. “marketing managers who buy ads”), or check back as the pool grows.',
  };
}

module.exports = {
  MAX_SHORTLIST,
  SHORTLIST_ROTATION_POOL,
  MIN_QUERY_LEN,
  MIN_TEXT_SCORE,
  SHORTLIST_BLURB_MAX,
  shortDisplayName,
  normalizeSearchQuery,
  tokenize,
  expandTokenForms,
  eventSearchTokens,
  extractQueryEventDate,
  looksLikeEventAttendeeQuery,
  extractQueryIntent,
  roleFitScore,
  isInternalMatchCandidate,
  queryMentionsNetworkerBrand,
  platformBrandMatchScore,
  scoreAgainstQuery,
  scoreEventTitle,
  eventDateProximityBoost,
  resolveEventMatchSelection,
  eventBoost,
  matchedEventBoost,
  hashSeed,
  weekBucket,
  rotateShortlistWindow,
  shortlistBlurb,
  toPublicShortlistCard,
  rankCandidates,
  mapSeedRow,
  mapMemberRow,
  emptyStateCopy,
  searchMatchmaker,
};
