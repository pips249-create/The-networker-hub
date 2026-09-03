/**
 * Browse / admin search matching — word-split AND, substring, light typo tolerance.
 * Treats "&" and "and" as the same connector. Typos (edit distance ≤ 1) only apply
 * to terms of 5+ characters.
 *
 * Email queries (containing @) keep dots and skip fuzzy variants so admin
 * "search by email" matches contact_email / email columns via PostgREST.
 */

const FUZZY_MIN_LEN = 5;
const MAX_TERM_LEN = 48;
const MAX_EMAIL_LEN = 120;

/** "&" and "and" are interchangeable connectors in group/event names. */
function normalizeAmpersands(text) {
  return String(text || '')
    .replace(/&+/g, ' and ')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeEmailQuery(query) {
  return String(query || '').includes('@');
}

function sanitizeSearchTerm(term) {
  return String(term || '')
    .trim()
    .toLowerCase()
    .replace(/[%_,.()\\]/g, '')
    .slice(0, MAX_TERM_LEN);
}

/** Keep email shape (dots, +, etc.); only strip LIKE wildcards. */
function sanitizeEmailSearchTerm(term) {
  return String(term || '')
    .trim()
    .toLowerCase()
    .replace(/[%]/g, '')
    .slice(0, MAX_EMAIL_LEN);
}

function tokenizeSearchQuery(query) {
  return normalizeAmpersands(String(query || ''))
    .toLowerCase()
    .split(/\s+/)
    .map(sanitizeSearchTerm)
    .filter(Boolean)
    .filter(function (t) {
      // Drop connector so "Wine & Dine" and "Wine and Dine" match the same way.
      return t !== 'and';
    });
}

function levenshtein(a, b) {
  const s = String(a || '');
  const t = String(b || '');
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  if (Math.abs(s.length - t.length) > 1) return 2;

  // Damerau–Levenshtein so adjacent swaps count as 1 (common typos).
  const n = s.length;
  const m = t.length;
  const d = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = s.charCodeAt(i - 1) === t.charCodeAt(j - 1) ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (
        i > 1 &&
        j > 1 &&
        s.charCodeAt(i - 1) === t.charCodeAt(j - 2) &&
        s.charCodeAt(i - 2) === t.charCodeAt(j - 1)
      ) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[n][m];
}

function haystackWords(haystack) {
  return normalizeAmpersands(String(haystack || ''))
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(function (w) {
      return w.length >= 4 && w !== 'and';
    });
}

function escapeRegExp(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-word match so short queries like "york" do not hit "yorkshire". */
function termMatchesWholeWord(term, haystack) {
  const re = new RegExp('(?:^|[^a-z0-9])' + escapeRegExp(term) + '(?:[^a-z0-9]|$)');
  return re.test(haystack);
}

function termMatchesHaystack(term, haystack) {
  const t = sanitizeSearchTerm(term);
  if (!t || t === 'and') return true;
  const hay = normalizeAmpersands(String(haystack || '')).toLowerCase();
  /* Short terms: whole-word only (york ≠ yorkshire). Longer: substring for progressive typing. */
  if (t.length < FUZZY_MIN_LEN) {
    return termMatchesWholeWord(t, hay);
  }
  if (hay.indexOf(t) !== -1) return true;

  const words = haystackWords(hay);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (Math.abs(w.length - t.length) > 1) continue;
    if (levenshtein(t, w) <= 1) return true;
  }
  return false;
}

function haystackMatchesQuery(haystack, query) {
  if (looksLikeEmailQuery(query)) {
    const email = sanitizeEmailSearchTerm(query);
    if (!email) return true;
    return String(haystack || '')
      .toLowerCase()
      .includes(email);
  }
  const terms = tokenizeSearchQuery(query);
  if (!terms.length) return true;
  const hay = normalizeAmpersands(String(haystack || '')).toLowerCase();
  for (let i = 0; i < terms.length; i++) {
    if (!termMatchesHaystack(terms[i], hay)) return false;
  }
  return true;
}

/** Adjacent transpositions + edge deletions for PostgREST ilike ORs. */
function typoVariantTerms(term) {
  const t = sanitizeSearchTerm(term);
  if (!t || t.length < FUZZY_MIN_LEN) return [];

  const out = [];
  const seen = Object.create(null);
  function add(v) {
    if (!v || v.length < 4 || seen[v] || v === t) return;
    seen[v] = true;
    out.push(v);
  }

  for (let i = 0; i < t.length - 1; i++) {
    add(t.slice(0, i) + t.charAt(i + 1) + t.charAt(i) + t.slice(i + 2));
  }
  // Extra/missing letter at the ends are the common cases; keep the OR list small.
  add(t.slice(1));
  add(t.slice(0, -1));
  return out;
}

function searchTermIlikePatterns(term, options) {
  const opts = options || {};
  const t = sanitizeSearchTerm(term);
  if (!t || t === 'and') return [];

  const patterns = [];
  if (opts.exact !== false) {
    patterns.push('%' + t + '%');
  }

  const fuzzy = opts.fuzzy !== false && t.length >= FUZZY_MIN_LEN;
  if (!fuzzy) return patterns;

  const variants = typoVariantTerms(t);
  for (let i = 0; i < variants.length; i++) {
    patterns.push('%' + variants[i] + '%');
  }
  // Single-character substitution via LIKE `_` so e.g. "manchaster" still hits "manchester".
  if (opts.substitutions !== false) {
    for (let i = 0; i < t.length; i++) {
      patterns.push('%' + t.slice(0, i) + '_' + t.slice(i + 1) + '%');
    }
  }
  return patterns;
}

/**
 * PostgREST reserved chars in filter values (.,,:*() ) must be double-quoted.
 * @see https://docs.postgrest.org/en/stable/references/api/url_grammar.html
 */
function formatIlikeFilter(field, pattern) {
  const col = String(field || '').trim();
  const p = String(pattern || '');
  if (!col) return '';
  if (/[,.:*()]/.test(p) || p.includes('"') || p.includes('\\')) {
    const escaped = p.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return col + '.ilike."' + escaped + '"';
  }
  return col + '.ilike.' + p;
}

/**
 * Build PostgREST `.or(...)` filter strings (one per query term; AND them together).
 * Returns null when there is nothing to filter.
 */
function buildIlikeOrFilters(query, fields) {
  const fieldList = (fields || []).filter(Boolean);
  if (!fieldList.length) return null;

  if (looksLikeEmailQuery(query)) {
    const email = sanitizeEmailSearchTerm(query);
    if (!email) return null;
    const pattern = '%' + email + '%';
    const parts = fieldList.map(function (field) {
      return formatIlikeFilter(field, pattern);
    }).filter(Boolean);
    return parts.length ? [parts.join(',')] : null;
  }

  const terms = tokenizeSearchQuery(query);
  if (!terms.length) return null;

  return terms
    .map(function (term) {
      const patterns = searchTermIlikePatterns(term);
      const parts = [];
      for (let i = 0; i < patterns.length; i++) {
        for (let j = 0; j < fieldList.length; j++) {
          const part = formatIlikeFilter(fieldList[j], patterns[i]);
          if (part) parts.push(part);
        }
      }
      return parts.join(',');
    })
    .filter(Boolean);
}

/** Apply word-split + fuzzy ilike filters to a Supabase/PostgREST query builder. */
function applyIlikeSearch(dbQuery, query, fields) {
  const filters = buildIlikeOrFilters(query, fields);
  if (!filters || !filters.length) return dbQuery;
  let next = dbQuery;
  for (let i = 0; i < filters.length; i++) {
    next = next.or(filters[i]);
  }
  return next;
}

module.exports = {
  FUZZY_MIN_LEN,
  normalizeAmpersands,
  looksLikeEmailQuery,
  sanitizeSearchTerm,
  sanitizeEmailSearchTerm,
  tokenizeSearchQuery,
  levenshtein,
  termMatchesHaystack,
  haystackMatchesQuery,
  typoVariantTerms,
  searchTermIlikePatterns,
  formatIlikeFilter,
  buildIlikeOrFilters,
  applyIlikeSearch,
};
