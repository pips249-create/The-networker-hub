const { getOrganiserApi } = require('../organiser-provider');
const { countSavesForOpportunityIds } = require('../supabase-opportunity-favourites');
const { jsonPublicError } = require('../public-error');

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

function opportunityPayloadFromBody(body, session) {
  const types = Array.isArray(body.types)
    ? body.types.map((t) => String(t || '').trim()).filter(Boolean)
    : body.type
      ? [String(body.type || '').trim()].filter(Boolean)
      : [];

  return {
    title: String(body.title || '').trim(),
    type: types[0] || String(body.type || '').trim(),
    types,
    category: String(body.category || '').trim(),
    description: String(body.description || body.desc || '').trim(),
    about: body.about,
    aboutText: body.aboutText,
    host: String(body.host || body.company || '').trim(),
    contactEmail: String(body.contactEmail || body.email || '').trim(),
    meta: body.meta,
    tags: body.tags,
    packageTier: body.packageTier,
    listingStatus: body.listingStatus != null ? body.listingStatus : body.status,
    ownerEmail: String(session?.email || '').toLowerCase(),
    ownerUserId: session?.sub || '',
    photoBase64: body.photoBase64 || body.imageBase64 || null,
    photoMime: body.photoMime || body.imageMime || null,
    photoFilename: body.photoFilename || body.imageFilename || null,
    photoUrl: Object.prototype.hasOwnProperty.call(body, 'photoUrl')
      ? String(body.photoUrl || body.imageUrl || '').trim()
      : undefined,
    logoBase64: body.logoBase64 || null,
    logoMime: body.logoMime || null,
    logoFilename: body.logoFilename || null,
    logoUrl: Object.prototype.hasOwnProperty.call(body, 'logoUrl')
      ? String(body.logoUrl || '').trim()
      : undefined,
  };
}

async function attachSaveCounts(opportunities) {
  const list = opportunities || [];
  if (!list.length) return list;
  try {
    const counts = await countSavesForOpportunityIds(list.map((o) => o.id));
    return list.map((o) => ({ ...o, saveCount: counts[o.id] || 0 }));
  } catch {
    return list.map((o) => ({ ...o, saveCount: 0 }));
  }
}

module.exports = async function handler(req, res) {
  const api = getOrganiserApi();
  const {
    json,
    setCors,
    requireOrganiserSession,
    isPlatformAdmin,
    listOpportunitiesForSession,
    getOpportunityById,
    opportunityOwnedBySession,
    createOpportunity,
    updateOpportunity,
    airtableSetupHint,
  } = api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  if (!createOpportunity) {
    return json(res, 503, {
      error: 'opportunities_unavailable',
      message: 'Opportunity listings require Supabase. Set DATA_PROVIDER=supabase.',
    });
  }

  async function ownedOpportunities() {
    const opportunities = await listOpportunitiesForSession(auth.session);
    return { opportunities, allowed: new Set(opportunities.map((o) => o.id)) };
  }

  if (req.method === 'GET') {
    const opportunityId = String(req.query?.id || '').trim();
    try {
      if (opportunityId) {
        const { allowed } = await ownedOpportunities();
        if (!isPlatformAdmin(auth.session) && !allowed.has(opportunityId)) {
          return json(res, 403, { error: 'opportunity_not_owned' });
        }
        const opportunity = await getOpportunityById(opportunityId);
        if (!opportunity) return json(res, 404, { error: 'not_found' });
        const [enriched] = await attachSaveCounts([opportunity]);
        return json(res, 200, { ok: true, opportunity: enriched || opportunity });
      }
      const opportunities = await attachSaveCounts(await listOpportunitiesForSession(auth.session));
      return json(res, 200, { ok: true, opportunities });
    } catch (e) {
      return jsonPublicError(res, json, e, { code: 'opportunities_fetch_failed', logLabel: '[organiser-opportunities]', extra: { airtable: airtableSetupHint ? airtableSetupHint('opportunities') : undefined } });
    }
  }

  if (req.method === 'PATCH') {
    const body = parseBody(req);
    const opportunityId = String(body.id || req.query?.id || '').trim();
    if (!opportunityId) return json(res, 400, { error: 'missing_opportunity_id' });

    try {
      const existing = await getOpportunityById(opportunityId);
      if (!existing) return json(res, 404, { error: 'not_found' });
      if (
        !isPlatformAdmin(auth.session) &&
        !opportunityOwnedBySession(auth.session, existing)
      ) {
        return json(res, 403, { error: 'opportunity_not_owned' });
      }

      const base = opportunityPayloadFromBody(body, auth.session);
      if (!base.title) return json(res, 400, { error: 'missing_title' });
      if (!base.host) return json(res, 400, { error: 'missing_host' });
      const opportunity = await updateOpportunity(opportunityId, base);
      return json(res, 200, { ok: true, opportunity });
    } catch (e) {
      return jsonPublicError(res, json, e, { code: 'opportunity_update_failed', logLabel: '[organiser-opportunities]' });
    }
  }

  if (req.method === 'POST') {
    const body = parseBody(req);
    const base = opportunityPayloadFromBody(body, auth.session);
    if (!base.title) return json(res, 400, { error: 'missing_title' });
    if (!base.ownerEmail) return json(res, 400, { error: 'missing_email' });
    if (base.listingStatus == null) base.listingStatus = 'draft';
    const isDraft = String(base.listingStatus).toLowerCase() === 'draft';
    if (!isDraft) {
      if (!base.host) return json(res, 400, { error: 'missing_host' });
      if (!base.types.length && !base.type) return json(res, 400, { error: 'missing_type' });
    }

    try {
      const opportunity = await createOpportunity(base);
      return json(res, 200, { ok: true, opportunity });
    } catch (e) {
      return jsonPublicError(res, json, e, { code: 'opportunity_create_failed', logLabel: '[organiser-opportunities]' });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
