/** Standard 8-4-4-4-12 hex UUID (matches Postgres uuid type; no RFC version/variant check). */
const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const UUID_RE = new RegExp('^' + UUID_PATTERN + '$', 'i');

function isUuid(value) {
  return UUID_RE.test(String(value || '').trim());
}

module.exports = {
  isUuid,
  UUID_RE,
  UUID_PATTERN,
};
