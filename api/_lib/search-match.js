/**
 * Browse filter search matching — word-split AND, substring, light typo tolerance.
 * Typos (edit distance ≤ 1) only apply to terms of 5+ characters.
 */

const FUZZY_MIN_LEN = 5;
const MAX_TERM_LEN = 48;

function sanitizeSearchTerm(term) {
  return String(term || '')
    .trim()
    .toLowerCase()
    .replace(/[%_,.()\\]/g, '')
    .slice(0, MAX_TERM_LEN);
}

function tokenizeSearchQuery(query) {
  return String(query || '')
    .toLowerCase()
    .split(/\s+/)
    .map(sanitizeSearchTerm)
    .filter(Boolean);
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
  return String(haystack || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(function (w) {
      return w.length >= 4;
    });
}

function termMatchesHaystack(term, haystack) {
  const t = sanitizeSearchTerm(term);
  if (!t) return true;
  const hay = String(haystack || '').toLowerCase();
  if (hay.indexOf(t) !== -1) return true;
  if (t.length < FUZZY_MIN_LEN) return false;

  const words = haystackWords(hay);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (Math.abs(w.length - t.length) > 1) continue;
    if (levenshtein(t, w) <= 1) return true;
  }
  return false;
}

function haystackMatchesQuery(haystack, query) {
  const terms = tokenizeSearchQuery(query);
  if (!terms.length) return true;
  const hay = String(haystack || '').toLowerCase();
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

function searchTermIlikePatterns(term) {
  const t = sanitizeSearchTerm(term);
  if (!t) return [];
  const patterns = ['%' + t + '%'];
  const variants = typoVariantTerms(t);
  for (let i = 0; i < variants.length; i++) {
    patterns.push('%' + variants[i] + '%');
  }
  return patterns;
}

module.exports = {
  FUZZY_MIN_LEN,
  sanitizeSearchTerm,
  tokenizeSearchQuery,
  levenshtein,
  termMatchesHaystack,
  haystackMatchesQuery,
  typoVariantTerms,
  searchTermIlikePatterns,
};
