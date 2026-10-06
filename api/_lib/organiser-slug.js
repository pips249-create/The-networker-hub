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

/** attempt 0 is the name slug; later attempts append -2, -3, … */
function organiserSlugCandidate(name, attempt) {
  const base = slugifyOrganiserName(name) || 'networking-group';
  const n = Number(attempt) || 0;
  if (n <= 0) return base.slice(0, 80);
  return (base.slice(0, 72) + '-' + (n + 1)).slice(0, 80);
}

/**
 * Persist a unique public slug so /organisers/:slug resolves.
 * Returns the stored slug, or '' when none could be saved.
 */
async function assignUniqueOrganiserSlug(sb, organiserId, name) {
  const id = String(organiserId || '').trim();
  if (!sb || !id) return '';
  const { data: current, error: readErr } = await sb
    .from('organisers')
    .select('id, slug, name')
    .eq('id', id)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  const stored = String((current && current.slug) || '').trim();
  if (stored && !isUuidSlug(stored)) return stored;
  const label = String((current && current.name) || name || '').trim();
  for (let n = 0; n < 40; n++) {
    const candidate = organiserSlugCandidate(label, n);
    const { error } = await sb.from('organisers').update({ slug: candidate }).eq('id', id);
    if (!error) return candidate;
    if (!/unique|duplicate/i.test(error.message || '')) throw new Error(error.message);
  }
  return '';
}

module.exports = {
  slugifyOrganiserName,
  isUuidSlug,
  publicOrganiserSlug,
  organiserSlugCandidate,
  assignUniqueOrganiserSlug,
};
