/**
 * Browse filter search matching — word-split AND, substring, light typo tolerance.
 * Mirrors api/_lib/search-match.js for client-side opportunity (and similar) filters.
 */
(function (global) {
  var FUZZY_MIN_LEN = 5;
  var MAX_TERM_LEN = 48;

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
    var s = String(a || '');
    var t = String(b || '');
    if (s === t) return 0;
    if (!s.length) return t.length;
    if (!t.length) return s.length;
    if (Math.abs(s.length - t.length) > 1) return 2;

    // Damerau–Levenshtein so adjacent swaps count as 1 (common typos).
    var n = s.length;
    var m = t.length;
    var d = [];
    var i;
    var j;
    for (i = 0; i <= n; i++) {
      d[i] = [];
      d[i][0] = i;
    }
    for (j = 0; j <= m; j++) d[0][j] = j;

    for (i = 1; i <= n; i++) {
      for (j = 1; j <= m; j++) {
        var cost = s.charCodeAt(i - 1) === t.charCodeAt(j - 1) ? 0 : 1;
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
    var t = sanitizeSearchTerm(term);
    if (!t) return true;
    var hay = String(haystack || '').toLowerCase();
    if (hay.indexOf(t) !== -1) return true;
    if (t.length < FUZZY_MIN_LEN) return false;

    var words = haystackWords(hay);
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (Math.abs(w.length - t.length) > 1) continue;
      if (levenshtein(t, w) <= 1) return true;
    }
    return false;
  }

  function haystackMatchesQuery(haystack, query) {
    var terms = tokenizeSearchQuery(query);
    if (!terms.length) return true;
    var hay = String(haystack || '').toLowerCase();
    for (var i = 0; i < terms.length; i++) {
      if (!termMatchesHaystack(terms[i], hay)) return false;
    }
    return true;
  }

  global.HubSearchMatch = {
    FUZZY_MIN_LEN: FUZZY_MIN_LEN,
    sanitizeSearchTerm: sanitizeSearchTerm,
    tokenizeSearchQuery: tokenizeSearchQuery,
    levenshtein: levenshtein,
    termMatchesHaystack: termMatchesHaystack,
    haystackMatchesQuery: haystackMatchesQuery,
  };
})(typeof window !== 'undefined' ? window : globalThis);
