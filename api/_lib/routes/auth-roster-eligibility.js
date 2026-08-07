const { setCors, json, sessionFromRequest } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { isUuid } = require('../uuid');
const {
  getActiveRosterMembership,
  loadMemberTicketsForEvent,
} = require('../organiser-member-roster');

async function sessionManagesOrganiser(session, organiserId) {
  const orgId = String(organiserId || '').trim();
  if (!session?.email || !orgId || !isUuid(orgId)) return false;
  try {
    const { listGroupsForSession } = require('../supabase-organiser');
    // Personal workspace only — do not use admin "all groups" view.
    const groups = await listGroupsForSession(session, false);
    return (groups || []).some((g) => String(g.id) === orgId);
  } catch (err) {
    console.error('[roster-eligibility] managesOrganiser check failed', err?.message || err);
    return false;
  }
}

/**
 * GET ?eventId= or ?organiserId= or ?organiserIds=a,b
 * Returns roster membership for signed-in attendee and member-only tickets for an event.
 * Also reports whether the signed-in user manages the organiser page (owner/editor).
 */
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

  const email = String(session.email || '')
    .trim()
    .toLowerCase();
  const eventId = String(req.query?.eventId || req.query?.event_id || '').trim();
  const organiserIdsRaw = String(req.query?.organiserIds || req.query?.organiser_ids || '').trim();
  const organiserIdSingle = String(req.query?.organiserId || req.query?.organiser_id || '').trim();

  const organiserIds = [];
  if (organiserIdSingle && isUuid(organiserIdSingle)) organiserIds.push(organiserIdSingle);
  organiserIdsRaw.split(',').forEach((part) => {
    const id = String(part || '').trim();
    if (isUuid(id) && !organiserIds.includes(id)) organiserIds.push(id);
  });

  try {
    const sb = getSupabaseAdmin();
    let targetOrganiserId = organiserIds[0] || null;
    let memberTickets = [];

    if (eventId && isUuid(eventId)) {
      const evRes = await sb
        .from('events')
        .select('id, organiser_id')
        .eq('id', eventId)
        .maybeSingle();
      if (evRes.error) throw new Error(evRes.error.message);
      if (!evRes.data) return json(res, 404, { ok: false, error: 'event_not_found' });
      targetOrganiserId = evRes.data.organiser_id;
      if (targetOrganiserId && !organiserIds.includes(targetOrganiserId)) {
        organiserIds.push(targetOrganiserId);
      }
    }

    const membershipByOrganiser = {};
    for (const orgId of organiserIds.slice(0, 40)) {
      const membership = await getActiveRosterMembership(sb, {
        organiserId: orgId,
        email,
        userId: session.sub || null,
      });
      membershipByOrganiser[orgId] = {
        active: membership.active,
        expiresAt: membership.row?.expires_at || null,
      };
    }

    if (eventId && isUuid(eventId) && targetOrganiserId) {
      const membership = membershipByOrganiser[targetOrganiserId];
      if (membership?.active) {
        memberTickets = await loadMemberTicketsForEvent(sb, eventId);
      }
    }

    const managesOrganiser = targetOrganiserId
      ? await sessionManagesOrganiser(session, targetOrganiserId)
      : false;
    const isMember = targetOrganiserId
      ? Boolean(membershipByOrganiser[targetOrganiserId]?.active)
      : false;

    return json(res, 200, {
      ok: true,
      email,
      membershipByOrganiser,
      isMember,
      managesOrganiser,
      memberTickets,
    });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: 'roster_eligibility_failed',
      message: e.message,
    });
  }
};
