const {
  json,
  setCors,
  requireOrganiserSession,
  listGroupsForSession,
  groupOwnedBySession,
  createGroup,
  getGroupById,
  updateGroup,
  isPlatformAdmin,
  airtableSetupHint,
} = require('../organiser');

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
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  if (req.method === 'GET') {
    const groupId = String(req.query?.id || '').trim();
    try {
      if (groupId) {
        const groups = await listGroupsForSession(auth.session);
        if (!isPlatformAdmin(auth.session) && !groupOwnedBySession(auth.session, groups, groupId)) {
          return json(res, 403, { error: 'group_not_owned' });
        }
        const group = await getGroupById(groupId);
        return json(res, 200, { ok: true, group });
      }
      const groups = await listGroupsForSession(auth.session);
      return json(res, 200, { ok: true, groups });
    } catch (e) {
      return json(res, e.status || 500, {
        error: 'groups_fetch_failed',
        message: e.message,
        airtable: airtableSetupHint('groups'),
      });
    }
  }

  if (req.method === 'PATCH') {
    const body = parseBody(req);
    const groupId = String(body.id || body.groupId || req.query?.id || '').trim();
    const name = String(body.name || '').trim();
    if (!groupId) return json(res, 400, { error: 'missing_group_id' });
    if (!name) return json(res, 400, { error: 'missing_name' });

    try {
      const groups = await listGroupsForSession(auth.session);
      if (!groupOwnedBySession(auth.session, groups, groupId)) {
        return json(res, 403, { error: 'group_not_owned' });
      }
      const group = await updateGroup(groupId, {
        name,
        description: body.description,
        website: body.website,
        location: body.location,
        logoUrl: body.logoUrl,
        logoBase64: body.logoBase64,
        logoMime: body.logoMime,
        logoFilename: body.logoFilename,
      });
      return json(res, 200, {
        ok: true,
        group,
        logoWarning: group.logoWarning || null,
      });
    } catch (e) {
      return json(res, e.status || 500, {
        error: 'group_update_failed',
        message: e.message,
        airtable: airtableSetupHint('groups'),
      });
    }
  }

  if (req.method === 'POST') {
    let body = parseBody(req);
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
      const group = await createGroup({
        userId: auth.session.sub || '',
        email: auth.session.email,
        name,
        description,
        website,
        location,
        logoUrl,
        logoBase64,
        logoMime,
        logoFilename,
      });
      return json(res, 201, {
        ok: true,
        group,
        logoWarning: group.logoWarning || null,
      });
    } catch (e) {
      return json(res, e.status || 500, {
        error: 'group_create_failed',
        message: e.message,
        airtable: airtableSetupHint('groups'),
      });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
