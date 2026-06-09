const { getOrganiserApi } = require('../organiser-provider');

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

function opportunityPayloadFromBody(body) {
  return {
    groupId: String(body.organiserGroupId || body.groupId || '').trim(),
    title: String(body.title || '').trim(),
    type: String(body.type || '').trim(),
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
    photoBase64: body.photoBase64 || body.imageBase64 || null,
    photoMime: body.photoMime || body.imageMime || null,
    photoFilename: body.photoFilename || body.imageFilename || null,
    photoUrl: Object.prototype.hasOwnProperty.call(body, 'photoUrl')
      ? String(body.photoUrl || body.imageUrl || '').trim()
      : undefined,
  };
}

module.exports = async function handler(req, res) {
  const api = getOrganiserApi();
  const {
    json,
    setCors,
    requireOrganiserSession,
    listGroupsForSession,
    groupOwnedBySession,
    isPlatformAdmin,
    listOpportunitiesForOrganiserIds,
    getOpportunityById,
    createOpportunity,
    updateOpportunity,
    airtableSetupHint,
  } = api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  if (!createOpportunity) {
    return json(res, 503, {
      error: 'opportunities_unavailable',
      message: 'Opportunity listings require Supabase. Set DATA_PROVIDER=supabase.',
    });
  }

  async function ownedOpportunityIds() {
    const groups = await listGroupsForSession(auth.session);
    const groupIds = groups.map((g) => g.id);
    const opportunities = await listOpportunitiesForOrganiserIds(groupIds);
    return { groups, opportunities, allowed: new Set(opportunities.map((o) => o.id)) };
  }

  if (req.method === 'GET') {
    const opportunityId = String(req.query?.id || '').trim();
    try {
      if (opportunityId) {
        const { groups, allowed } = await ownedOpportunityIds();
        if (!isPlatformAdmin(auth.session) && !allowed.has(opportunityId)) {
          return json(res, 403, { error: 'opportunity_not_owned' });
        }
        const opportunity = await getOpportunityById(opportunityId);
        if (!opportunity) return json(res, 404, { error: 'not_found' });
        return json(res, 200, { ok: true, opportunity });
      }
      const groups = await listGroupsForSession(auth.session);
      const opportunities = await listOpportunitiesForOrganiserIds(groups.map((g) => g.id));
      return json(res, 200, { ok: true, opportunities, groups });
    } catch (e) {
      return json(res, e.status || 500, {
        error: 'opportunities_fetch_failed',
        message: e.message,
        airtable: airtableSetupHint ? airtableSetupHint('opportunities') : undefined,
      });
    }
  }

  if (req.method === 'PATCH') {
    const body = parseBody(req);
    const opportunityId = String(body.id || req.query?.id || '').trim();
    if (!opportunityId) return json(res, 400, { error: 'missing_opportunity_id' });

    try {
      const { groups, allowed } = await ownedOpportunityIds();
      if (!isPlatformAdmin(auth.session) && !allowed.has(opportunityId)) {
        return json(res, 403, { error: 'opportunity_not_owned' });
      }
      const base = opportunityPayloadFromBody(body);
      if (!base.title) return json(res, 400, { error: 'missing_title' });
      if (!base.groupId) return json(res, 400, { error: 'missing_group' });
      if (!base.host) return json(res, 400, { error: 'missing_host' });
      if (!groupOwnedBySession(auth.session, groups, base.groupId)) {
        return json(res, 403, { error: 'group_not_owned' });
      }
      const opportunity = await updateOpportunity(opportunityId, base);
      return json(res, 200, { ok: true, opportunity });
    } catch (e) {
      return json(res, e.status || 500, {
        error: 'opportunity_update_failed',
        message: e.message,
      });
    }
  }

  if (req.method === 'POST') {
    const body = parseBody(req);
    const base = opportunityPayloadFromBody(body);
    if (!base.title) return json(res, 400, { error: 'missing_title' });
    if (!base.groupId) return json(res, 400, { error: 'missing_group' });
    if (base.listingStatus == null) base.listingStatus = 'draft';
    const isDraft = String(base.listingStatus).toLowerCase() === 'draft';
    if (!isDraft) {
      if (!base.host) return json(res, 400, { error: 'missing_host' });
      if (!base.type) return json(res, 400, { error: 'missing_type' });
    }

    try {
      const groups = await listGroupsForSession(auth.session);
      if (!groupOwnedBySession(auth.session, groups, base.groupId)) {
        return json(res, 403, { error: 'group_not_owned' });
      }
      const opportunity = await createOpportunity(base);
      return json(res, 200, { ok: true, opportunity });
    } catch (e) {
      return json(res, e.status || 500, {
        error: 'opportunity_create_failed',
        message: e.message,
      });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
