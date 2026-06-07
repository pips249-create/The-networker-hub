const { sessionFromRequest, json, setCors } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');

const REASONS = new Set([
  'misleading',
  'spam',
  'wrong_details',
  'offensive',
  'duplicate',
  'other',
]);

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
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'not_configured' });
  }

  const body = parseBody(req);
  const listingType = String(body.listing_type || body.listingType || '').trim().toLowerCase();
  const reason = String(body.reason || '').trim().toLowerCase();
  const details = String(body.details || '').trim().slice(0, 2000);
  const eventId = body.event_id || body.eventId || null;
  const organiserId = body.organiser_id || body.organiserId || null;
  const listingTitle = String(body.listing_title || body.listingTitle || '').trim().slice(0, 300);

  if (!['event', 'organiser'].includes(listingType)) {
    return json(res, 400, { ok: false, error: 'invalid_listing_type' });
  }
  if (!REASONS.has(reason)) {
    return json(res, 400, { ok: false, error: 'invalid_reason' });
  }
  if (listingType === 'event' && !eventId) {
    return json(res, 400, { ok: false, error: 'event_id_required' });
  }
  if (listingType === 'organiser' && !organiserId) {
    return json(res, 400, { ok: false, error: 'organiser_id_required' });
  }

  const session = sessionFromRequest(req);
  const reporterEmail = session?.email ? String(session.email).trim() : String(body.reporter_email || '').trim() || null;

  try {
    const sb = getSupabaseAdmin();
    const row = {
      listing_type: listingType,
      event_id: listingType === 'event' ? eventId : null,
      organiser_id: listingType === 'organiser' ? organiserId : null,
      listing_title: listingTitle || (listingType === 'event' ? 'Event' : 'Organiser'),
      reporter_user_id: session?.userId || null,
      reporter_email: reporterEmail,
      reason,
      details: details || null,
      status: 'open',
    };
    const insertRes = await sb.from('listing_reports').insert(row).select('id, created_at').single();
    if (insertRes.error) throw new Error(insertRes.error.message);
    return json(res, 200, { ok: true, id: insertRes.data.id, createdAt: insertRes.data.created_at });
  } catch (e) {
    return json(res, 500, { ok: false, error: 'report_failed', message: e.message });
  }
};
