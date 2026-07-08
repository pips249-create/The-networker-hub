const GREETING_FALLBACKS = new Set(['there', 'guest']);

function emailGreetingName(name, fallback = '') {
  const trimmed = String(name || '').trim();
  if (!trimmed) return fallback;
  if (GREETING_FALLBACKS.has(trimmed.toLowerCase())) return trimmed;
  const first = trimmed.split(/\s+/)[0];
  return first || fallback;
}

module.exports = {
  emailGreetingName,
};
