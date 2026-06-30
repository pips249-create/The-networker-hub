const { setCors, json, sessionFromRequest } = require('../auth');
const {
  listOrganiserFavourites,
  toggleOrganiserFavourite,
  removeOrganiserFavourite,
} = require('../supabase-organiser-favourites');
const { isSupabaseConfigured } = require('../supabase');

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = sessionFromRequest(req);
  if (!session) return json(res, 401, { error: 'not_authenticated' });

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured', favourites: [] });
  }

  try {
    if (req.method === 'GET') {
      const favourites = await listOrganiserFavourites(session);
      const ids = favourites.map((f) => f.organiserId);
      return json(res, 200, { ok: true, favourites, organiserIds: ids });
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const organiserId = body.organiserId || body.organiser_id;
      const result = await toggleOrganiserFavourite(session, organiserId);
      const favourites = await listOrganiserFavourites(session);
      return json(res, 200, {
        ok: true,
        ...result,
        organiserIds: favourites.map((f) => f.organiserId),
      });
    }

    if (req.method === 'DELETE') {
      const body = parseBody(req);
      const organiserId = body.organiserId || body.organiser_id || req.query?.organiserId;
      await removeOrganiserFavourite(session, organiserId);
      const favourites = await listOrganiserFavourites(session);
      return json(res, 200, {
        ok: true,
        organiserIds: favourites.map((f) => f.organiserId),
      });
    }

    return json(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    return json(res, 500, { ok: false, error: 'organiser_favourites_failed', message: e.message });
  }
};
