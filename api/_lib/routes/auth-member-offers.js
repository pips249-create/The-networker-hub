const { setCors, json, sessionFromRequest, requireAdminLive, isAdminRole } = require('../auth');
const {
  normalizeMemberOfferInput,
  isMemberOfferId,
  listMemberOffers,
  createMemberOffer,
  updateMemberOffer,
  deleteMemberOffer,
} = require('../member-offers');

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body && typeof body === 'object' ? body : {};
}

function offerIdFromRequest(req, body) {
  const fromBody = body && (body.id || body.offerId);
  if (fromBody) return String(fromBody).trim();
  try {
    const url = new URL(req.url || '', 'https://internal.local');
    return String(url.searchParams.get('id') || '').trim();
  } catch {
    return '';
  }
}

function notReady(res) {
  return json(res, 503, {
    ok: false,
    error: 'not_ready',
    message: 'Member offers are not available yet.',
  });
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = sessionFromRequest(req);
  if (!session) return json(res, 401, { error: 'not_authenticated' });

  const { isSupabaseConfigured } = require('../supabase');
  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured', offers: [] });
  }

  const write = req.method === 'POST' || req.method === 'PATCH' || req.method === 'DELETE';
  let canManage = false;
  if (write || isAdminRole(session.role)) {
    const gate = await requireAdminLive(session);
    if (write && !gate.ok) {
      return json(res, gate.status || 403, {
        error: gate.error || 'admin_only',
        message: gate.message,
      });
    }
    canManage = Boolean(gate.ok);
  }

  try {
    if (req.method === 'GET') {
      const offers = await listMemberOffers({ includeUnpublished: canManage });
      return json(res, 200, { ok: true, offers, canManage });
    }

    if (req.method === 'POST') {
      const parsed = normalizeMemberOfferInput(parseBody(req));
      if (!parsed.ok) {
        return json(res, 400, { ok: false, error: 'invalid_offer', fields: parsed.errors });
      }
      const offer = await createMemberOffer(parsed.fields, session.sub || session.userId || session.id);
      return json(res, 200, { ok: true, offer, canManage: true });
    }

    if (req.method === 'PATCH' || req.method === 'DELETE') {
      const body = parseBody(req);
      const id = offerIdFromRequest(req, body);
      if (!isMemberOfferId(id)) {
        return json(res, 400, { ok: false, error: 'invalid_id' });
      }
      if (req.method === 'DELETE') {
        const removed = await deleteMemberOffer(id);
        if (!removed) return json(res, 404, { ok: false, error: 'not_found' });
        return json(res, 200, { ok: true, id, canManage: true });
      }
      const parsed = normalizeMemberOfferInput(body, { partial: true });
      if (!parsed.ok) {
        return json(res, 400, { ok: false, error: 'invalid_offer', fields: parsed.errors });
      }
      if (!Object.keys(parsed.fields).length) {
        return json(res, 400, { ok: false, error: 'empty_update' });
      }
      const offer = await updateMemberOffer(id, parsed.fields);
      if (!offer) return json(res, 404, { ok: false, error: 'not_found' });
      return json(res, 200, { ok: true, offer, canManage: true });
    }

    return json(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    if (e && e.code === 'not_ready') return notReady(res);
    console.error('[member-offers]', e && e.message ? e.message : e);
    return json(res, 500, { ok: false, error: 'member_offers_failed' });
  }
};
