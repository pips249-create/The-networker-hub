const { organiserPersonalScopeFromRequest } = require('../auth');
const { getOrganiserApi } = require('../organiser-provider');
const { assertDescriptionLimit } = require('../text-limits');
const { assertOrganiserEmailVerified, isPublishIntent } = require('../organiser-access-guard');

function organiserApi() {
  return getOrganiserApi();
}

function adminViewForRequest(req, session) {
  const api = organiserApi();
  return api.isPlatformAdmin(session) && !organiserPersonalScopeFromRequest(req);
}

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

module.exports = async function handler(req, res) {
  const { json, setCors, requireOrganiserSession } = getOrganiserApi();
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  const api = organiserApi();

  if (req.method === 'GET') {
    const groupId = String(req.query?.id || '').trim();
    try {
      if (groupId) {
        const groups = await api.listGroupsForSession(auth.session);
        if (!api.isPlatformAdmin(auth.session) && !api.groupOwnedBySession(auth.session, groups, groupId)) {
          return json(res, 403, { error: 'group_not_owned' });
        }
        const raw = await api.getGroupById(groupId);
        const group = await api.enrichGroupForDashboard(
          raw,
          auth.session,
          adminViewForRequest(req, auth.session)
        );
        return json(res, 200, { ok: true, group });
      }
      const groups = await api.listGroupsForSession(auth.session);
      return json(res, 200, { ok: true, groups });
    } catch (e) {
      return json(res, e.status || 500, {
        error: 'groups_fetch_failed',
        message: e.message,
        airtable: api.airtableSetupHint && api.airtableSetupHint('groups'),
      });
    }
  }

  if (req.method === 'PATCH') {
    const body = parseBody(req);
    const groupId = String(body.id || body.groupId || req.query?.id || '').trim();
    const name = String(body.name || '').trim();
    const listingStatus = body.listingStatus != null ? body.listingStatus : null;
    if (isPublishIntent({ listingStatus })) {
      const verified = await assertOrganiserEmailVerified(auth.session);
      if (!verified.ok) {
        return json(res, verified.status, {
          error: verified.error,
          message: verified.message,
        });
      }
    }
    if (!groupId) return json(res, 400, { error: 'missing_group_id' });
    const hasProfileFields =
      name ||
      listingStatus != null ||
      body.description !== undefined ||
      body.website !== undefined ||
      body.instagramUrl !== undefined ||
      body.facebookUrl !== undefined ||
      body.linkedinUrl !== undefined ||
      body.xUrl !== undefined ||
      body.location !== undefined ||
      body.logoUrl ||
      body.logoBase64 ||
      body.complimentaryVisitsAllowed !== undefined ||
      body.complimentary_visits_allowed !== undefined;
    if (!hasProfileFields) return json(res, 400, { error: 'missing_fields' });

    try {
      const groups = await api.listGroupsForSession(auth.session);
      if (!api.groupOwnedBySession(auth.session, groups, groupId)) {
        return json(res, 403, { error: 'group_not_owned' });
      }
      if (body.description !== undefined) {
        assertDescriptionLimit(body.description, 'Profile description');
      }
      const updated = await api.updateGroup(groupId, {
        name: name || undefined,
        description: body.description,
        website: body.website,
        instagramUrl: body.instagramUrl,
        facebookUrl: body.facebookUrl,
        linkedinUrl: body.linkedinUrl,
        xUrl: body.xUrl,
        location: body.location,
        contactEmail: body.contactEmail,
        industries: body.industries,
        meetingFormats: body.meetingFormats,
        logoUrl: body.logoUrl,
        logoBase64: body.logoBase64,
        logoMime: body.logoMime,
        logoFilename: body.logoFilename,
        listingStatus,
        complimentaryVisitsAllowed:
          body.complimentaryVisitsAllowed ?? body.complimentary_visits_allowed,
      });
      const group = await api.enrichGroupForDashboard(
        updated,
        auth.session,
        adminViewForRequest(req, auth.session)
      );
      const saveWarnings = updated.saveWarnings || [];
      const message =
        saveWarnings.length && listingStatus != null
          ? 'Profile saved. ' + saveWarnings.join(' ')
          : saveWarnings.length
            ? saveWarnings.join(' ')
            : null;
      return json(res, 200, {
        ok: true,
        group,
        logoWarning: updated.logoWarning || null,
        logoResolutionWarning: updated.logoResolutionWarning || null,
        saveWarnings,
        message,
      });
    } catch (e) {
      return json(res, e.status || 500, {
        error: e.code || 'group_update_failed',
        message: e.message,
        airtable: api.airtableSetupHint && api.airtableSetupHint('groups'),
      });
    }
  }

  if (req.method === 'POST') {
    let body = parseBody(req);
    const action = String(body.action || '').toLowerCase().trim();
    const actionGroupId = String(body.id || body.groupId || '').trim();

    const { resolveOrganiserAccess } = require('../supabase-organiser-access');
    const access = await resolveOrganiserAccess(auth.session);
    const isCreateAction = action === 'duplicate' || (!action && String(body.name || '').trim());
    if (
      isCreateAction &&
      !access.canCreateGroups &&
      !api.isPlatformAdmin(auth.session)
    ) {
      return json(res, 403, {
        error: 'forbidden',
        message: 'Only the account owner can create or duplicate networking groups.',
      });
    }

    if (action === 'unpublish' && actionGroupId) {
      try {
        const groups = await api.listGroupsForSession(auth.session);
        if (!api.groupOwnedBySession(auth.session, groups, actionGroupId)) {
          return json(res, 403, { error: 'group_not_owned' });
        }
        const updated = await api.unpublishGroup(actionGroupId);
        const group = await api.enrichGroupForDashboard(
          updated,
          auth.session,
          adminViewForRequest(req, auth.session)
        );
        return json(res, 200, { ok: true, group });
      } catch (e) {
        return json(res, e.status || 500, {
          error: 'group_unpublish_failed',
          message: e.message,
          airtable: api.airtableSetupHint && api.airtableSetupHint('groups'),
        });
      }
    }

    if (action === 'duplicate' && actionGroupId) {
      try {
        const groups = await api.listGroupsForSession(auth.session);
        if (!api.groupOwnedBySession(auth.session, groups, actionGroupId)) {
          return json(res, 403, { error: 'group_not_owned' });
        }
        const source = await api.getGroupById(actionGroupId);
        if (!source) return json(res, 404, { error: 'group_not_found' });
        let copyName = String(source.name || 'Group').trim() || 'Group';
        if (!/\(copy\)$/i.test(copyName)) copyName += ' (copy)';
        const created = await api.createGroup({
          session: auth.session,
          userId: auth.session.sub || '',
          email: auth.session.email,
          contactEmail: source.contactEmail || auth.session.email,
          name: copyName,
          description: source.description || '',
          website: source.website || '',
          instagramUrl: source.instagramUrl || '',
          facebookUrl: source.facebookUrl || '',
          linkedinUrl: source.linkedinUrl || '',
          xUrl: source.xUrl || '',
          location: source.location || '',
          industries: source.industries || [],
          meetingFormats: source.meetingFormats || [],
          logoUrl: source.imageUrl || '',
          listingStatus: 'draft',
          verificationStatus: 'Pending',
        });
        const group = await api.enrichGroupForDashboard(
          created,
          auth.session,
          adminViewForRequest(req, auth.session)
        );
        return json(res, 201, {
          ok: true,
          group,
          message: 'Group duplicated as a draft — review the copy and publish when ready. Bank details are not copied; set up Stripe separately if you sell paid tickets on this page.',
        });
      } catch (e) {
        return json(res, e.status || 500, {
          error: 'group_duplicate_failed',
          message: e.message,
          airtable: api.airtableSetupHint && api.airtableSetupHint('groups'),
        });
      }
    }

    const name = String(body.name || '').trim();
    const description = String(body.description || '').trim();
    const website = String(body.website || '').trim();
    const location = String(body.location || '').trim();
    const logoUrl = String(body.logoUrl || '').trim();
    const logoBase64 = body.logoBase64 ? String(body.logoBase64) : '';
    const logoMime = body.logoMime ? String(body.logoMime) : '';
    const logoFilename = body.logoFilename ? String(body.logoFilename) : '';
    if (!name) return json(res, 400, { error: 'missing_name' });

    try {
      assertDescriptionLimit(description, 'Profile description');
      const created = await api.createGroup({
        session: auth.session,
        userId: auth.session.sub || '',
        email: auth.session.email,
        contactEmail: body.contactEmail || auth.session.email,
        name,
        description,
        website,
        location,
        industries: body.industries || [],
        meetingFormats: body.meetingFormats || [],
        logoUrl,
        logoBase64,
        logoMime,
        logoFilename,
        listingStatus: body.listingStatus || 'draft',
        verificationStatus: body.verificationStatus || 'Pending',
      });
      const group = await api.enrichGroupForDashboard(
        created,
        auth.session,
        adminViewForRequest(req, auth.session)
      );
      return json(res, 201, {
        ok: true,
        group,
        logoWarning: created.logoWarning || null,
        logoResolutionWarning: created.logoResolutionWarning || null,
        saveWarnings: created.saveWarnings || [],
        message: created.saveWarnings?.length
          ? 'Profile created. ' + created.saveWarnings.join(' ')
          : null,
      });
    } catch (e) {
      return json(res, e.status || 500, {
        error: e.code || 'group_create_failed',
        message: e.message,
        airtable: api.airtableSetupHint && api.airtableSetupHint('groups'),
      });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
