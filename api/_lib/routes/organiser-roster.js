const { getOrganiserApi } = require('../organiser-provider');
const { assertOrganiserEmailVerified } = require('../organiser-access-guard');
const {
  listRosterForOrganiser,
  upsertRosterMember,
  removeRosterMember,
  importRosterCsv,
  parseRosterCsv,
  buildRosterReports,
  sendMemberRosterBookingReminders,
  enrichMembersWithBookings,
} = require('../organiser-member-roster');

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

async function assertGroupAccess(api, session, organiserId) {
  const groups = await api.listGroupsForSession(session);
  if (!api.groupOwnedBySession(session, groups, organiserId)) {
    const err = new Error('group_not_owned');
    err.status = 403;
    throw err;
  }
}

module.exports = async function handler(req, res) {
  const api = getOrganiserApi();
  const { json, setCors, requireOrganiserSession } = api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  const verified = await assertOrganiserEmailVerified(auth.session);
  if (!verified.ok) {
    return json(res, verified.status, {
      error: verified.error,
      message: verified.message,
    });
  }

  const organiserId = String(
    req.query?.organiserId || req.query?.organiser_id || req.query?.groupId || ''
  ).trim();

  try {
    if (req.method === 'GET') {
      const action = String(req.query?.action || 'list').trim().toLowerCase();
      if (!organiserId) return json(res, 400, { ok: false, error: 'missing_organiser_id' });
      await assertGroupAccess(api, auth.session, organiserId);

      if (action === 'reports') {
        const eventId = String(req.query?.eventId || req.query?.event_id || '').trim();
        const recentRaw = String(req.query?.recentEventIds || req.query?.recent_event_ids || '');
        const recentEventIds = recentRaw
          ? recentRaw.split(',').map((s) => s.trim()).filter(Boolean)
          : [];
        const reports = await buildRosterReports(organiserId, { eventId, recentEventIds });
        return json(res, 200, { ok: true, reports });
      }

      const status = String(req.query?.status || 'active').trim().toLowerCase();
      const members = await enrichMembersWithBookings(
        organiserId,
        await listRosterForOrganiser(organiserId, { status })
      );
      return json(res, 200, { ok: true, members });
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const groupId = String(
        organiserId || body.organiserId || body.organiser_id || body.groupId || ''
      ).trim();
      if (!groupId) return json(res, 400, { ok: false, error: 'missing_organiser_id' });
      await assertGroupAccess(api, auth.session, groupId);

      if (body.csv || body.csvText || body.csv_text) {
        const rows = parseRosterCsv(body.csv || body.csvText || body.csv_text);
        const sendInvite = body.sendInvites === true || body.send_invites === true;
        const result = await importRosterCsv(groupId, rows, { sendInvite });
        return json(res, 200, { ok: true, ...result });
      }

      const action = String(body.action || '').trim().toLowerCase();
      if (action === 'remind-not-booked' || action === 'remind_not_booked') {
        const eventId = String(body.eventId || body.event_id || '').trim();
        if (!eventId) return json(res, 400, { ok: false, error: 'missing_event_id' });
        const result = await sendMemberRosterBookingReminders(groupId, eventId);
        return json(res, 200, { ok: true, ...result });
      }

      const sendInvite = body.sendInvite !== false && body.send_invite !== false;
      const result = await upsertRosterMember(groupId, body, { sendInvite });
      return json(res, 200, { ok: true, ...result });
    }

    if (req.method === 'PATCH') {
      const body = parseBody(req);
      const groupId = String(
        organiserId || body.organiserId || body.organiser_id || body.groupId || ''
      ).trim();
      const memberId = String(body.id || body.memberId || '').trim();
      if (!groupId || !memberId) {
        return json(res, 400, { ok: false, error: 'missing_fields' });
      }
      await assertGroupAccess(api, auth.session, groupId);
      const { getSupabaseAdmin } = require('../supabase');
      const sb = getSupabaseAdmin();
      const existing = await sb
        .from('organiser_member_roster')
        .select('*')
        .eq('organiser_id', groupId)
        .eq('id', memberId)
        .maybeSingle();
      if (existing.error) throw new Error(existing.error.message);
      if (!existing.data) return json(res, 404, { ok: false, error: 'roster_member_not_found' });
      const result = await upsertRosterMember(groupId, {
        email: body.email || existing.data.email,
        name: body.name != null ? body.name : existing.data.name,
        expiresAt:
          body.expiresAt != null
            ? body.expiresAt
            : body.expires_at != null
              ? body.expires_at
              : existing.data.expires_at,
        status: body.status || existing.data.status,
        resendInvite: body.resendInvite || body.resend_invite,
      }, {
        sendInvite: body.resendInvite || body.resend_invite ? true : false,
        resendInvite: Boolean(body.resendInvite || body.resend_invite),
      });
      return json(res, 200, { ok: true, ...result });
    }

    if (req.method === 'DELETE') {
      const memberId = String(req.query?.id || req.query?.memberId || '').trim();
      if (!organiserId || !memberId) {
        return json(res, 400, { ok: false, error: 'missing_fields' });
      }
      await assertGroupAccess(api, auth.session, organiserId);
      await removeRosterMember(organiserId, memberId);
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    return json(res, e.status || 500, {
      ok: false,
      error: e.message || 'roster_failed',
      message: e.message,
    });
  }
};
