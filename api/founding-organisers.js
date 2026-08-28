/**
 * GET /api/founding-organisers
 * Public list for homepage strip and site-access preview gateway.
 * ?for=gateway — all founding claimants (social proof on the gated preview page)
 * default — first-50 homepage showcase while founding_homepage_until is active
 */
const { json, setCors } = require('./_lib/auth');
const { getSupabaseAdmin } = require('./_lib/supabase');
const { publicOrganiserSlug } = require('./_lib/organiser-slug');
const { organiserDisplayPhotoUrl } = require('./_lib/supabase-organisers-browse');
const { logoStripUrl } = require('./_lib/logo-strip-url');
const {
  listFoundingHomepageOrganisers,
  listFoundingOrganisersForGateway,
  FOUNDING_HOMEPAGE_UNTIL,
  FOUNDING_HOMEPAGE_CAP,
  isBmukName,
} = require('./_lib/founding-organiser');

const BMUK_WEBSITE = 'https://bmuklondon.co.uk/';

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
  const bmuk = isBmukName(row && row.name);
  const website = bmuk ? BMUK_WEBSITE : safeWebsite(row.website);
  const hubHref = includeHubHref && slug ? '/organisers/' + encodeURIComponent(slug) : '';
  return {
    id: row.id,
    name: String(row.name || '').trim() || 'Organiser',
    slug,
    href: website || hubHref,
    // Strip-sized CDN rewrite — full uploads were leaving blank marquee tiles for seconds.
    photoUrl: logoStripUrl(organiserDisplayPhotoUrl(row)),
    website,
    industry: industries[0] || '',
    foundingOrganiser: true,
    logoBandDark: Boolean(row.logo_band_dark || row.logoBandDark),
    softLaunch: Boolean(row.soft_launch || row.softLaunch),
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

    // Public list changes rarely — short CDN cache avoids a cold serverless hit on every home view.
    // (auth.json always sets no-store, so respond directly.)
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Cache-Control',
      'public, max-age=120, s-maxage=300, stale-while-revalidate=600'
    );
    return res.status(200).json({
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
