const {
  json,
  setCors,
  requireOrganiserSession,
  listGroupsForSession,
  createGroup,
  airtableSetupHint,
} = require('../organiser');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  if (req.method === 'GET') {
    try {
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

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
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
      return json(res, 201, { ok: true, group });
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
