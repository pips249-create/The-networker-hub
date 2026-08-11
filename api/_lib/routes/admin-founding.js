/**
 * Command Centre — Founding Organiser cohort management.
 * GET  /api/admin/founding
 * POST /api/admin/founding  { action, organiserId }
 */
const { json } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { publicOrganiserSlug } = require('../organiser-slug');
const {
  FOUNDING_HOMEPAGE_CAP,
  FOUNDING_HOMEPAGE_UNTIL,
  FOUNDING_CLAIM_DEADLINE,
  isFoundingClaimWindow,
} = require('../founding-organiser');

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body || {};
}

function mapRow(row) {
  const homepageUntil = row.founding_homepage_until || null;
  const homepageActive =
    Boolean(homepageUntil) && new Date(homepageUntil).getTime() > Date.now();
  return {
    id: row.id,
    name: String(row.name || '').trim() || 'Untitled',
    slug: publicOrganiserSlug(row) || '',
    email: String(row.contact_email || row.email || '').trim().toLowerCase(),
    website: String(row.website || '').trim(),
    photoUrl: String(row.photo_url || '').trim(),
    ownershipClaimStatus: row.ownership_claim_status || null,
    ownershipClaimedAt: row.ownership_claimed_at || null,
    foundingOrganiserAt: row.founding_organiser_at || null,
    foundingHomepageUntil: homepageUntil,
    foundingHomepage: homepageActive,
  };
}

async function listFounding(sb) {
  const { data, error } = await sb
    .from('organisers')
    .select(
      'id, name, slug, email, contact_email, website, photo_url, ownership_claim_status, ownership_claimed_at, founding_organiser_at, founding_homepage_until'
    )
    .not('founding_organiser_at', 'is', null)
    .order('founding_organiser_at', { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data || []).map(mapRow);
}

async function homepageSlotCount(sb) {
  const { count, error } = await sb
    .from('organisers')
    .select('id', { count: 'exact', head: true })
    .not('founding_homepage_until', 'is', null)
    .gt('founding_homepage_until', new Date().toISOString());
  if (error) throw new Error(error.message);
  return count || 0;
}

async function getOrganiser(sb, id) {
  const { data, error } = await sb
    .from('organisers')
    .select(
      'id, name, slug, email, contact_email, website, photo_url, ownership_claim_status, ownership_claimed_at, founding_organiser_at, founding_homepage_until'
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

module.exports = async function handler(req, res) {
  if (!isSupabaseConfigured()) {
    return json(res, 503, { error: 'supabase_not_configured' });
  }

  const sb = getSupabaseAdmin();

  if (req.method === 'GET') {
    try {
      const q = String(req.query?.q || '').trim().toLowerCase();
      let organisers = await listFounding(sb);
      if (q) {
        organisers = organisers.filter((o) => {
          const hay = [o.name, o.email, o.slug, o.website].join(' ').toLowerCase();
          return hay.indexOf(q) !== -1;
        });
      }
      const homepageUsed = organisers.filter((o) => o.foundingHomepage).length;
      const missingLogo = organisers.filter((o) => !o.photoUrl).length;
      const missingWebsite = organisers.filter((o) => !o.website).length;
      const needsAssets = organisers.filter((o) => !o.photoUrl || !o.website).length;
      return json(res, 200, {
        ok: true,
        organisers,
        stats: {
          foundingCount: organisers.length,
          homepageUsed,
          homepageCap: FOUNDING_HOMEPAGE_CAP,
          homepageUntil: FOUNDING_HOMEPAGE_UNTIL.toISOString(),
          claimDeadline: FOUNDING_CLAIM_DEADLINE.toISOString(),
          claimWindowOpen: isFoundingClaimWindow(),
          missingLogo,
          missingWebsite,
          needsAssets,
        },
      });
    } catch (e) {
      console.error('admin-founding GET', e);
      return json(res, 500, { error: 'server_error', message: e.message || String(e) });
    }
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  try {
    const body = parseBody(req);
    const action = String(body.action || '').trim().toLowerCase();
    const organiserId = String(body.organiserId || body.id || '').trim();
    if (!organiserId) {
      return json(res, 400, { error: 'missing_organiser_id' });
    }

    const row = await getOrganiser(sb, organiserId);
    if (!row) return json(res, 404, { error: 'not_found' });

    const now = new Date();
    let patch = null;

    if (action === 'award' || action === 'grant_badge') {
      patch = {
        founding_organiser_at: row.founding_organiser_at || now.toISOString(),
      };
    } else if (action === 'revoke' || action === 'revoke_badge') {
      patch = {
        founding_organiser_at: null,
        founding_homepage_until: null,
      };
    } else if (action === 'homepage_on' || action === 'grant_homepage') {
      if (!row.founding_organiser_at) {
        return json(res, 400, {
          error: 'not_founding',
          message: 'Award the founding badge before adding a homepage slot.',
        });
      }
      const used = await homepageSlotCount(sb);
      const already = row.founding_homepage_until && new Date(row.founding_homepage_until).getTime() > Date.now();
      if (!already && used >= FOUNDING_HOMEPAGE_CAP) {
        return json(res, 400, {
          error: 'homepage_full',
          message: 'Homepage showcase is full (' + FOUNDING_HOMEPAGE_CAP + ' slots).',
        });
      }
      patch = {
        founding_homepage_until: FOUNDING_HOMEPAGE_UNTIL.toISOString(),
      };
    } else if (action === 'homepage_off' || action === 'revoke_homepage') {
      patch = { founding_homepage_until: null };
    } else {
      return json(res, 400, { error: 'unknown_action', message: 'Unknown action: ' + action });
    }

    const { data, error } = await sb
      .from('organisers')
      .update(patch)
      .eq('id', organiserId)
      .select(
        'id, name, slug, email, contact_email, website, photo_url, ownership_claim_status, ownership_claimed_at, founding_organiser_at, founding_homepage_until'
      )
      .single();
    if (error) throw new Error(error.message);

    return json(res, 200, { ok: true, organiser: mapRow(data), action });
  } catch (e) {
    console.error('admin-founding POST', e);
    return json(res, 500, { error: 'server_error', message: e.message || String(e) });
  }
};
