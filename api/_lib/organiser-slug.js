/**
 * URL slugs for public organiser pages (/organisers/:slug).
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function slugifyOrganiserName(name) {
  return String(name || '')
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

function publicOrganiserSlug(row) {
  if (!row) return null;
  const stored = row.slug ? String(row.slug).trim() : '';
  if (stored && !isUuidSlug(stored)) return stored;
  const fromName = slugifyOrganiserName(row.name);
  return fromName || null;
}

module.exports = {
  slugifyOrganiserName,
  isUuidSlug,
  publicOrganiserSlug,
};
