/**
 * GET /api/founding-organisers
 * Public list for homepage strip and site-access preview gateway.
 * ?for=gateway — all founding claimants (social proof on the gated preview page)
 * default — first-50 homepage showcase while founding_homepage_until is active
 */
const { json, setCors } = require('./_lib/auth');
const { getSupabaseAdmin } = require('./_lib/supabase');
const { publicOrganiserSlug } = require('./_lib/organiser-slug');
const {
  listFoundingHomepageOrganisers,
  listFoundingOrganisersForGateway,
  FOUNDING_HOMEPAGE_UNTIL,
  FOUNDING_HOMEPAGE_CAP,
} = require('./_lib/founding-organiser');

function resolvePhotoUrl(raw) {
  const url = String(raw || '').trim();
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return url;
  return '';
}

function safeWebsite(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    const u = new URL(raw.startsWith('http') ? raw : 'https://' + raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.toString();
  } catch {
    return '';
  }
}

function mapRow(row, { includeHubHref }) {
  const slug = publicOrganiserSlug(row) || '';
  const industries = Array.isArray(row.industries) ? row.industries.filter(Boolean) : [];
  return {
    id: row.id,
    name: String(row.name || '').trim() || 'Organiser',
    slug,
    href: includeHubHref && slug ? '/organisers/' + encodeURIComponent(slug) : '',
    photoUrl: resolvePhotoUrl(row.photo_url),
    website: safeWebsite(row.website),
    industry: industries[0] || '',
    foundingOrganiser: true,
  };
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'GET') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  try {
    const sb = getSupabaseAdmin();
    const forGateway = String(req.query?.for || '').trim().toLowerCase() === 'gateway';
    const rows = forGateway
      ? await listFoundingOrganisersForGateway(sb, 48)
      : await listFoundingHomepageOrganisers(sb);
    const organisers = rows.map((row) => mapRow(row, { includeHubHref: !forGateway }));

    return json(res, 200, {
      ok: true,
      organisers,
      for: forGateway ? 'gateway' : 'homepage',
      cap: forGateway ? 48 : FOUNDING_HOMEPAGE_CAP,
      until: FOUNDING_HOMEPAGE_UNTIL.toISOString(),
    });
  } catch (e) {
    console.error('founding-organisers', e);
    return json(res, 500, { error: 'server_error', message: e.message || String(e) });
  }
};
