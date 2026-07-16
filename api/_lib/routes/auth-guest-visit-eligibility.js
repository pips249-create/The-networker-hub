const { setCors, json, sessionFromRequest } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { isUuid } = require('../uuid');
const {
  getGuestVisitEligibility,
  loadOrganiserGuestVisitAllowance,
  PLATFORM_MAX_COMPLIMENTARY_VISITS,
} = require('../guest-visits');

function emptyEligibility() {
  return {
    allowed: 0,
    used: 0,
    remaining: 0,
    eligible: false,
    platformMax: PLATFORM_MAX_COMPLIMENTARY_VISITS,
  };
}

function parseOrganiserIds(query) {
  const raw = String(query?.organiserIds || query?.organiser_ids || '').trim();
  if (!raw) return [];
  const seen = new Set();
  const out = [];
  raw.split(',').forEach((part) => {
    const id = String(part || '').trim();
    if (!isUuid(id) || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  });
  return out.slice(0, 40);
}

async function eligibilityForOrganiser(sb, organiserId, session) {
  const allowed = await loadOrganiserGuestVisitAllowance(sb, organiserId);
  const email = String(session.email || '')
    .trim()
    .toLowerCase();
  return getGuestVisitEligibility(sb, {
    organiserId,
    attendeeId: session.sub || null,
    email,
    allowed,
  });
}

/** GET ?eventId= or ?organiserIds=id1,id2 — guest visit eligibility for the signed-in attendee. */
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

  const organiserIds = parseOrganiserIds(req.query);
  const eventId = String(req.query?.eventId || req.query?.event_id || '').trim();

  try {
    const sb = getSupabaseAdmin();

    if (organiserIds.length) {
      const entries = await Promise.all(
        organiserIds.map(async (organiserId) => {
          try {
            const eligibility = await eligibilityForOrganiser(sb, organiserId, session);
            return [organiserId, eligibility];
          } catch {
            return [organiserId, emptyEligibility()];
          }
        })
      );
      const byOrganiserId = {};
      entries.forEach(([id, eligibility]) => {
        byOrganiserId[id] = eligibility;
      });
      return json(res, 200, {
        ok: true,
        viewerEmail: String(session.email || '')
          .trim()
          .toLowerCase(),
        byOrganiserId,
      });
    }

    if (!isUuid(eventId)) {
      return json(res, 400, { ok: false, error: 'invalid_event_id' });
    }

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
        eligibility: emptyEligibility(),
        guestPassesDisabled: true,
      });
    }

    const organiserId = evRes.data.organiser_id;
    if (!organiserId) {
      return json(res, 200, {
        ok: true,
        attendanceMode: evRes.data.attendance_mode || 'tickets',
        eligibility: emptyEligibility(),
      });
    }

    const eligibility = await eligibilityForOrganiser(sb, organiserId, session);

    return json(res, 200, {
      ok: true,
      attendanceMode: evRes.data.attendance_mode || 'tickets',
      organiserId,
      viewerEmail: String(session.email || '')
        .trim()
        .toLowerCase(),
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
