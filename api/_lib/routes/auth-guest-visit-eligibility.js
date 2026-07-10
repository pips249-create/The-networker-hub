const { setCors, json, sessionFromRequest } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { isUuid } = require('../uuid');
const {
  getGuestVisitEligibility,
  loadOrganiserGuestVisitAllowance,
} = require('../guest-visits');

/** GET ?eventId= — guest visit eligibility for the signed-in attendee on this organiser. */
module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  const session = sessionFromRequest(req);
  if (!session) {
    return json(res, 401, { ok: false, error: 'not_authenticated' });
  }

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  const eventId = String(req.query?.eventId || req.query?.event_id || '').trim();
  if (!isUuid(eventId)) {
    return json(res, 400, { ok: false, error: 'invalid_event_id' });
  }

  try {
    const sb = getSupabaseAdmin();
    const evRes = await sb
      .from('events')
      .select('id, organiser_id, attendance_mode, status, guest_passes_disabled')
      .eq('id', eventId)
      .maybeSingle();
    if (evRes.error) throw new Error(evRes.error.message);
    if (!evRes.data) return json(res, 404, { ok: false, error: 'event_not_found' });

    if (evRes.data.guest_passes_disabled) {
      return json(res, 200, {
        ok: true,
        attendanceMode: evRes.data.attendance_mode || 'tickets',
        eligibility: { allowed: 0, used: 0, remaining: 0, eligible: false, platformMax: 2 },
        guestPassesDisabled: true,
      });
    }

    const organiserId = evRes.data.organiser_id;
    if (!organiserId) {
      return json(res, 200, {
        ok: true,
        attendanceMode: evRes.data.attendance_mode || 'tickets',
        eligibility: { allowed: 0, used: 0, remaining: 0, eligible: false, platformMax: 2 },
      });
    }

    const allowed = await loadOrganiserGuestVisitAllowance(sb, organiserId);
    const email = String(session.email || '')
      .trim()
      .toLowerCase();
    const eligibility = await getGuestVisitEligibility(sb, {
      organiserId,
      attendeeId: session.sub || null,
      email,
      allowed,
    });

    return json(res, 200, {
      ok: true,
      attendanceMode: evRes.data.attendance_mode || 'tickets',
      organiserId,
      eligibility,
    });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: 'eligibility_failed',
      message: e.message || String(e),
    });
  }
};
