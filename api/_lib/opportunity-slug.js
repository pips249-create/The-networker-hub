/**
 * URL slugs for public opportunity pages (/opportunities/:slug).
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function slugifyOpportunityTitle(title) {
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

function publicOpportunitySlug(row) {
  if (!row) return null;
  const stored = row.slug ? String(row.slug).trim() : '';
  if (stored && !isUuidSlug(stored)) return stored;
  const fromTitle = slugifyOpportunityTitle(row.title);
  return fromTitle || null;
}

function slugMatchesPublicRow(row, slug) {
  const s = String(slug || '').trim().toLowerCase();
  if (!s || !row) return false;
  const stored = row.slug ? String(row.slug).trim().toLowerCase() : '';
  if (stored && stored === s) return true;
  const derived = slugifyOpportunityTitle(row.title);
  return derived && derived === s;
}

async function ensureOpportunitySlug(sb, { title, opportunityId, currentSlug }) {
  const existing = currentSlug ? String(currentSlug).trim() : '';
  if (existing && !isUuidSlug(existing)) return existing;

  const base = slugifyOpportunityTitle(title) || 'opportunity';
  let candidate = base;
  let n = 2;

  while (n < 100) {
    const { data, error } = await sb
      .from('business_opportunities')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data || (opportunityId && data.id === opportunityId)) return candidate;
    candidate = `${base}-${n}`;
    n += 1;
  }

  return `${base}-${String(opportunityId || '').slice(0, 8)}`;
}

module.exports = {
  slugifyOpportunityTitle,
  isUuidSlug,
  publicOpportunitySlug,
  slugMatchesPublicRow,
  ensureOpportunitySlug,
};
