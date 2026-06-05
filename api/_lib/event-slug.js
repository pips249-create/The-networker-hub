/**
 * URL slugs for public event pages (/events/:slug).
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function slugifyEventTitle(title) {
  return String(title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

function isUuidSlug(value) {
  return UUID_RE.test(String(value || '').trim());
}

function publicEventSlug(rowOrEvent) {
  if (!rowOrEvent) return null;
  const stored = rowOrEvent.slug ? String(rowOrEvent.slug).trim() : '';
  if (stored && !isUuidSlug(stored)) return stored;
  const title = rowOrEvent.title || '';
  const fromTitle = slugifyEventTitle(title);
  return fromTitle || (stored && !isUuidSlug(stored) ? stored : null);
}

async function ensureEventSlug(sb, { title, eventId, currentSlug }) {
  const existing = currentSlug ? String(currentSlug).trim() : '';
  if (existing && !isUuidSlug(existing)) return existing;

  const base = slugifyEventTitle(title) || 'event';
  let candidate = base;
  let n = 2;

  while (n < 100) {
    const { data, error } = await sb.from('events').select('id').eq('slug', candidate).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data || (eventId && data.id === eventId)) return candidate;
    candidate = `${base}-${n}`;
    n += 1;
  }

  return `${base}-${String(eventId || '').slice(0, 8)}`;
}

module.exports = {
  slugifyEventTitle,
  isUuidSlug,
  publicEventSlug,
  ensureEventSlug,
};
