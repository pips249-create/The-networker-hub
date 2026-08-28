/** Standard 8-4-4-4-12 hex UUID (matches Postgres uuid type; no RFC version/variant check). */
const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const UUID_RE = new RegExp('^' + UUID_PATTERN + '$', 'i');
const UUID_FIND_RE = new RegExp(UUID_PATTERN, 'i');

function firstScalar(value) {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const s = String(value[i] == null ? '' : value[i]).trim();
      if (s) return s;
    }
    return '';
  }
  if (value == null) return '';
  return String(value).trim();
}

function isUuid(value) {
  return UUID_RE.test(String(value || '').trim());
}

/**
 * Recover a UUID from query/body values that accidentally include a glued query string,
 * e.g. "uuid?id=other-uuid" from `/api/...?id=uuid?id=other`.
 * Returns '' when no UUID can be extracted.
 */
function coerceUuid(value) {
  let raw = firstScalar(value);
  if (!raw) return '';
  if (isUuid(raw)) return raw;

  try {
    const decoded = decodeURIComponent(raw.replace(/\+/g, ' ')).trim();
    if (decoded) raw = decoded;
  } catch {
    /* keep raw */
  }
  if (isUuid(raw)) return raw;

  const cut = raw.search(/[?#]/);
  if (cut > 0) {
    const head = raw.slice(0, cut).trim();
    if (isUuid(head)) return head;
  }

  const match = raw.match(UUID_FIND_RE);
  return match ? match[0] : '';
}

function hasIdInput(value) {
  return Boolean(firstScalar(value));
}

module.exports = {
  isUuid,
  coerceUuid,
  hasIdInput,
  firstScalar,
  UUID_RE,
  UUID_PATTERN,
};
